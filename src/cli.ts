import * as core from '@actions/core';
import { HttpClient } from '@actions/http-client';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

const TOOL_NAME = 'crowdin-cli';
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

/** Platforms for which Crowdin CLI publishes a native binary package on npm. */
const SUPPORTED_PLATFORMS = new Set([
  'linux-x64',
  'linux-arm64',
  'linux-x64-musl',
  'linux-arm64-musl',
  'darwin-x64',
  'darwin-arm64',
  'win32-x64',
]);

export interface InstallOptions {
  version: string;
  registryUrl: string;
  registryToken?: string;
  useInstalled: boolean;
}

/** Returns the bearer authorization header for `url`, sent only to the registry's own origin. */
export function registryAuthorization(url: string, registryUrl: string, token?: string): string | undefined {
  if (!token) return undefined;
  return new URL(url).origin === new URL(registryUrl).origin ? `Bearer ${token}` : undefined;
}

/** A glibc Linux reports glibcVersionRuntime; a musl one (Alpine) does not. */
export function isMusl(platform: NodeJS.Platform = process.platform): boolean {
  if (platform !== 'linux') return false;
  try {
    const report = process.report?.getReport() as { header?: { glibcVersionRuntime?: string } } | undefined;
    return !report?.header?.glibcVersionRuntime;
  } catch {
    return false;
  }
}

/** Returns the platform suffix of the `@crowdin/cli-<suffix>` npm package. */
export function platformSuffix(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
  musl: boolean = isMusl(platform),
): string {
  const suffix = `${platform}-${arch}${platform === 'linux' && musl ? '-musl' : ''}`;
  if (!SUPPORTED_PLATFORMS.has(suffix)) {
    throw new Error(
      `Crowdin CLI does not provide a native binary for ${suffix}. ` +
        `Supported platforms: ${[...SUPPORTED_PLATFORMS].join(', ')}. ` +
        'Install the CLI yourself and set `use_installed_cli: true` to use it.',
    );
  }
  return suffix;
}

export function binaryName(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? 'crowdin.exe' : 'crowdin';
}

interface PackageVersion {
  version: string;
  dist: { tarball: string; integrity?: string; shasum?: string };
}

interface Packument {
  'dist-tags'?: Record<string, string>;
  versions?: Record<string, PackageVersion>;
}

/** Resolves a version or dist-tag against an npm packument. */
export function resolveVersion(packument: Packument, spec: string): PackageVersion {
  const versions = packument.versions ?? {};
  const normalized = spec.replace(/^v/, '');
  const resolved = versions[normalized] ? normalized : packument['dist-tags']?.[spec];
  const pkg = resolved ? versions[resolved] : undefined;
  if (!pkg) {
    throw new Error(`Crowdin CLI version "${spec}" was not found in the npm registry`);
  }
  return pkg;
}

async function fetchPackument(registryUrl: string, packageName: string, token?: string): Promise<Packument> {
  const url = `${registryUrl.replace(/\/+$/, '')}/${packageName.replace('/', '%2F')}`;
  const headers: Record<string, string> = { accept: 'application/json' };
  const authorization = registryAuthorization(url, registryUrl, token);
  if (authorization) headers.authorization = authorization;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as Packument;
}

async function verifyIntegrity(file: string, dist: PackageVersion['dist']): Promise<void> {
  let algorithm: string;
  let expected: string;
  let encoding: 'base64' | 'hex';

  const sri = dist.integrity?.split(/\s+/).find((entry) => entry.startsWith('sha512-'));
  if (sri) {
    algorithm = 'sha512';
    expected = sri.slice('sha512-'.length);
    encoding = 'base64';
  } else if (dist.shasum) {
    algorithm = 'sha1';
    expected = dist.shasum;
    encoding = 'hex';
  } else {
    core.warning('The npm registry did not provide an integrity hash; skipping verification');
    return;
  }

  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  const actual = hash.digest(encoding);
  if (actual !== expected) {
    throw new Error(`Integrity check failed for ${dist.tarball}: expected ${expected}, got ${actual}`);
  }
}

class DownloadError extends Error {
  constructor(message: string, readonly retryable = false) {
    super(message);
  }
}

async function downloadAuthenticatedAttempt(url: string, authorization: string, destination: string): Promise<void> {
  let current = new URL(url);
  let currentAuthorization: string | undefined = authorization;

  for (let redirects = 0; redirects <= 20; redirects++) {
    const client = new HttpClient('crowdin-action', [], { allowRedirects: false });
    const headers = currentAuthorization ? { authorization: currentAuthorization } : {};
    const response = await client.get(current.href, headers);
    const status = response.message.statusCode ?? 0;
    const location = response.message.headers.location;

    if (REDIRECT_STATUS_CODES.has(status) && location) {
      response.message.destroy();
      if (redirects === 20) throw new DownloadError(`Too many redirects while downloading ${url}`);
      const next = new URL(location, current);
      if (next.protocol !== 'https:' && next.protocol !== 'http:') {
        throw new DownloadError(`Unsupported redirect protocol ${next.protocol} while downloading ${url}`);
      }
      if (current.protocol === 'https:' && next.protocol === 'http:') {
        throw new DownloadError(`Refusing HTTPS-to-HTTP redirect while downloading ${url}`);
      }
      // The toolkit client strips credentials only on hostname changes, not scheme or port changes.
      if (next.origin !== current.origin) currentAuthorization = undefined;
      current = next;
      continue;
    }

    if (status !== 200) {
      response.message.destroy();
      throw new DownloadError(
        `Failed to download ${current.href}: HTTP ${status} ${response.message.statusMessage ?? ''}`.trim(),
        status === 408 || status === 429 || status >= 500,
      );
    }
    await pipeline(response.message, createWriteStream(destination));
    return;
  }
}

async function downloadAuthenticated(url: string, authorization: string, destination: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await downloadAuthenticatedAttempt(url, authorization, destination);
      return;
    } catch (error) {
      if (attempt === 3 || (error instanceof DownloadError && !error.retryable)) throw error;
      core.info(`Crowdin CLI download failed (attempt ${attempt}/3); retrying in ${attempt} seconds`);
      await new Promise<void>((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
}

/**
 * Makes the `crowdin` executable available and returns its absolute path.
 * Downloads the native binary for the current platform from the npm registry and
 * caches it in the runner tool cache, unless an already installed CLI should be used.
 */
export async function installCli(options: InstallOptions): Promise<string> {
  if (options.useInstalled) {
    const existing = await io.which('crowdin', true);
    core.info(`Using the Crowdin CLI found on PATH: ${existing}`);
    return existing;
  }

  const suffix = platformSuffix();
  const arch = suffix.slice(suffix.indexOf('-') + 1);
  const exe = binaryName();

  if (tc.isExplicitVersion(options.version)) {
    const cached = tc.find(TOOL_NAME, options.version, arch);
    if (cached) {
      core.info(`Using cached Crowdin CLI ${options.version} (${suffix})`);
      core.addPath(cached);
      return path.join(cached, exe);
    }
  }

  const packageName = `@crowdin/cli-${suffix}`;
  const pkg = resolveVersion(
    await fetchPackument(options.registryUrl, packageName, options.registryToken),
    options.version,
  );

  const cached = tc.find(TOOL_NAME, pkg.version, arch);
  if (cached) {
    core.info(`Using cached Crowdin CLI ${pkg.version} (${suffix})`);
    core.addPath(cached);
    return path.join(cached, exe);
  }

  core.info(`Downloading Crowdin CLI ${pkg.version} from ${pkg.dist.tarball}`);
  const authorization = registryAuthorization(pkg.dist.tarball, options.registryUrl, options.registryToken);
  let downloadDir: string | undefined;
  try {
    let tarball: string;
    if (authorization) {
      downloadDir = await mkdtemp(path.join(process.env.RUNNER_TEMP || tmpdir(), 'crowdin-cli-'));
      tarball = path.join(downloadDir, 'cli.tgz');
      await downloadAuthenticated(pkg.dist.tarball, authorization, tarball);
    } else {
      tarball = await tc.downloadTool(pkg.dist.tarball);
    }
    await verifyIntegrity(tarball, pkg.dist);

    const extracted = await tc.extractTar(tarball);
    const binDir = path.join(extracted, 'package', 'bin');
    const binary = path.join(binDir, exe);
    if (!existsSync(binary)) {
      throw new Error(`The ${packageName}@${pkg.version} package does not contain bin/${exe}`);
    }
    if (process.platform !== 'win32') await chmod(binary, 0o755);

    const toolDir = await tc.cacheDir(binDir, TOOL_NAME, pkg.version, arch);
    core.addPath(toolDir);
    return path.join(toolDir, exe);
  } finally {
    if (downloadDir) await rm(downloadDir, { recursive: true, force: true });
  }
}
