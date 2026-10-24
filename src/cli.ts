import * as core from '@actions/core';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { chmod } from 'node:fs/promises';
import path from 'node:path';

const TOOL_NAME = 'crowdin-cli';

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
  useInstalled: boolean;
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

async function fetchPackument(registryUrl: string, packageName: string): Promise<Packument> {
  const url = `${registryUrl.replace(/\/+$/, '')}/${packageName.replace('/', '%2F')}`;
  const response = await fetch(url, { headers: { accept: 'application/json' } });
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
  const pkg = resolveVersion(await fetchPackument(options.registryUrl, packageName), options.version);

  const cached = tc.find(TOOL_NAME, pkg.version, arch);
  if (cached) {
    core.info(`Using cached Crowdin CLI ${pkg.version} (${suffix})`);
    core.addPath(cached);
    return path.join(cached, exe);
  }

  core.info(`Downloading Crowdin CLI ${pkg.version} from ${pkg.dist.tarball}`);
  const tarball = await tc.downloadTool(pkg.dist.tarball);
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
}
