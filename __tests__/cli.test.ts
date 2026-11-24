import * as tc from '@actions/tool-cache';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Duplex } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { binaryName, installCli, platformSuffix, registryAuthorization, resolveVersion } from '../src/cli.js';
import { readInputs } from '../src/inputs.js';

vi.mock('@actions/tool-cache', () => ({
  isExplicitVersion: vi.fn(() => true),
  find: vi.fn(() => ''),
  downloadTool: vi.fn(),
  extractTar: vi.fn(),
  cacheDir: vi.fn(),
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function serverUrl(server: Server): string {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a listening TCP server');
  return `http://127.0.0.1:${address.port}`;
}

async function listen(server: Server): Promise<void> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}

function respondWithPackage(response: ServerResponse, tarball: string, integrity?: string): void {
  const dist = { tarball, ...(integrity ? { integrity } : {}) };
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ versions: { '5.5.0': { version: '5.5.0', dist } } }));
}

function installFrom(registryUrl: string, registryToken?: string): Promise<string> {
  return installCli({ version: '5.5.0', registryUrl, registryToken, useInstalled: false });
}

describe('registryAuthorization', () => {
  const registry = 'https://registry.example.com/artifactory/api/npm/mirror';

  it.each([
    `${registry}/@crowdin%2Fcli-linux-x64`,
    'https://registry.example.com/packages/cli.tgz',
    'https://registry.example.com:443/packages/cli.tgz',
  ])('authenticates same-origin URL %s', (url) => {
    expect(registryAuthorization(url, registry, 'test-token')).toBe('Bearer test-token');
  });

  it.each([
    'https://cdn.example.com/cli.tgz',
    'https://registry.example.com.attacker.test/cli.tgz',
    'https://registry.example.com@attacker.test/cli.tgz',
    'http://registry.example.com/cli.tgz',
    'https://registry.example.com:8443/cli.tgz',
  ])('withholds credentials from different-origin URL %s', (url) => {
    expect(registryAuthorization(url, registry, 'test-token')).toBeUndefined();
  });

  it.each([undefined, ''])('omits authorization without a token (%s)', (token) => {
    expect(registryAuthorization(`${registry}/cli.tgz`, registry, token)).toBeUndefined();
  });
});

describe('installCli registry authentication', () => {
  it('does not pass the registry token to child processes', () => {
    vi.stubEnv('INPUT_NPM_REGISTRY_TOKEN', 'test-token');

    expect(readInputs().npmRegistryToken).toBe('test-token');
    const child = spawnSync(process.execPath, ['-e', 'process.stdout.write(process.env.INPUT_NPM_REGISTRY_TOKEN ?? "missing")'], {
      encoding: 'utf8',
    });
    expect(child.status).toBe(0);
    expect(child.stdout).toBe('missing');
  });

  it.each([
    ['same-origin tarball', 'test-token', true],
    ['cross-origin tarball', 'test-token', false],
    ['no token', undefined, false],
  ])('scopes credentials for %s', async (_scenario, token, sameOrigin) => {
    const received: { url: string | undefined; authorization: string | undefined }[] = [];
    let tarball: string;
    const registry = createServer((request, response) => {
      received.push({ url: request.url, authorization: request.headers.authorization });
      if (request.url === '/cli.tgz') {
        response.end('tarball');
      } else {
        respondWithPackage(response, tarball);
      }
    });
    const downloadError = new Error('stop before extraction');
    vi.mocked(tc.downloadTool).mockRejectedValue(downloadError);
    vi.mocked(tc.extractTar).mockRejectedValue(downloadError);

    try {
      await listen(registry);
      tarball = `${serverUrl(registry).replace('127.0.0.1', token && !sameOrigin ? 'localhost' : '127.0.0.1')}/cli.tgz`;
      await expect(installFrom(`${serverUrl(registry)}/artifactory/api/npm/mirror/`, token)).rejects.toBe(downloadError);

      expect(received[0]).toEqual({
        url: `/artifactory/api/npm/mirror/@crowdin%2Fcli-${platformSuffix()}`,
        authorization: token ? `Bearer ${token}` : undefined,
      });
      if (sameOrigin) {
        expect(received[1]).toEqual({ url: '/cli.tgz', authorization: `Bearer ${token}` });
        expect(tc.downloadTool).not.toHaveBeenCalled();
      } else {
        expect(received).toHaveLength(1);
        expect(tc.downloadTool).toHaveBeenCalledWith(tarball);
      }
    } finally {
      await close(registry);
    }
  });

  it('strips authorization when an authenticated tarball redirects to another port', async () => {
    const received: (string | undefined)[] = [];
    const destination = createServer((request, response) => {
      received.push(request.headers.authorization);
      response.end('tarball');
    });
    const registry = createServer((request, response) => {
      received.push(request.headers.authorization);
      if (request.url === '/cli.tgz') {
        response.writeHead(302, { location: `${serverUrl(destination)}/cli.tgz` });
        response.end();
      } else {
        respondWithPackage(response, `${serverUrl(registry)}/cli.tgz`);
      }
    });
    try {
      await listen(destination);
      await listen(registry);
      const extractionError = new Error('stop before extraction');
      vi.mocked(tc.extractTar).mockRejectedValue(extractionError);

      await expect(installFrom(serverUrl(registry), 'test-token')).rejects.toBe(extractionError);

      expect(received).toEqual(['Bearer test-token', 'Bearer test-token', undefined]);
    } finally {
      await Promise.all([close(registry), close(destination)]);
    }
  });

  it('strips authorization when the package metadata redirects to another origin', async () => {
    const received: (string | undefined)[] = [];
    const destination = createServer((request, response) => {
      received.push(request.headers.authorization);
      respondWithPackage(response, `${serverUrl(registry)}/cli.tgz`);
    });
    const registry = createServer((request, response) => {
      received.push(request.headers.authorization);
      if (request.url === '/cli.tgz') {
        response.end('tarball');
      } else {
        response.writeHead(302, { location: `${serverUrl(destination)}/metadata` }).end();
      }
    });
    try {
      await listen(destination);
      await listen(registry);
      const extractionError = new Error('stop before extraction');
      vi.mocked(tc.extractTar).mockRejectedValue(extractionError);

      await expect(installFrom(serverUrl(registry), 'test-token')).rejects.toBe(extractionError);

      expect(received).toEqual(['Bearer test-token', undefined, 'Bearer test-token']);
    } finally {
      await Promise.all([close(registry), close(destination)]);
    }
  });

  it('keeps authorization on same-origin redirects but does not restore it after leaving the origin', async () => {
    const received: [string | undefined, string | undefined][] = [];
    const destination = createServer((request, response) => {
      received.push([request.url, request.headers.authorization]);
      response.writeHead(302, { location: `${serverUrl(registry)}/return` }).end();
    });
    const registry = createServer((request, response) => {
      received.push([request.url, request.headers.authorization]);
      if (request.url === '/cli.tgz') {
        response.writeHead(302, { location: '/same-origin' }).end();
      } else if (request.url === '/same-origin') {
        response.writeHead(302, { location: `${serverUrl(destination)}/other-origin` }).end();
      } else if (request.url === '/return') {
        response.end('tarball');
      } else {
        respondWithPackage(response, `${serverUrl(registry)}/cli.tgz`);
      }
    });
    try {
      await listen(destination);
      await listen(registry);
      const extractionError = new Error('stop before extraction');
      vi.mocked(tc.extractTar).mockRejectedValue(extractionError);

      await expect(installFrom(serverUrl(registry), 'test-token')).rejects.toBe(extractionError);

      expect(received).toEqual([
        [`/@crowdin%2Fcli-${platformSuffix()}`, 'Bearer test-token'],
        ['/cli.tgz', 'Bearer test-token'],
        ['/same-origin', 'Bearer test-token'],
        ['/other-origin', undefined],
        ['/return', undefined],
      ]);
    } finally {
      await Promise.all([close(registry), close(destination)]);
    }
  });

  it('does not retry unauthorized downloads', async () => {
    let attempts = 0;
    const registry = createServer((request, response) => {
      if (request.url === '/cli.tgz') {
        attempts++;
        response.writeHead(401).end();
      } else {
        respondWithPackage(response, `${serverUrl(registry)}/cli.tgz`);
      }
    });
    try {
      await listen(registry);
      await expect(installFrom(serverUrl(registry), 'test-token')).rejects.toThrow('HTTP 401');
      expect(attempts).toBe(1);
    } finally {
      await close(registry);
    }
  });

  it('stops redirect loops without retrying', async () => {
    let attempts = 0;
    const registry = createServer((request, response) => {
      if (request.url === '/cli.tgz') {
        attempts++;
        response.writeHead(302, { location: '/cli.tgz' }).end();
      } else {
        respondWithPackage(response, `${serverUrl(registry)}/cli.tgz`);
      }
    });
    try {
      await listen(registry);
      await expect(installFrom(serverUrl(registry), 'test-token')).rejects.toThrow('Too many redirects');
      expect(attempts).toBe(21);
    } finally {
      await close(registry);
    }
  });

  it('retries rate-limited downloads', async () => {
    let attempts = 0;
    const registry = createServer((request, response) => {
      if (request.url === '/cli.tgz') {
        attempts++;
        if (attempts === 1) response.writeHead(429).end();
        else response.end('tarball');
      } else {
        respondWithPackage(response, `${serverUrl(registry)}/cli.tgz`);
      }
    });
    try {
      await listen(registry);
      const extractionError = new Error('stop before extraction');
      vi.mocked(tc.extractTar).mockRejectedValue(extractionError);

      await expect(installFrom(serverUrl(registry), 'test-token')).rejects.toBe(extractionError);
      expect(attempts).toBe(2);
    } finally {
      await close(registry);
    }
  });

  it('retries transient and interrupted downloads before installing a verified archive', async () => {
    const temp = await mkdtemp(path.join(tmpdir(), 'crowdin-cli-test-'));
    const received: (string | undefined)[] = [];
    let attempts = 0;
    let archive: Buffer;
    const registry = createServer((request, response) => {
      received.push(request.headers.authorization);
      if (request.url === '/cli.tgz') {
        attempts++;
        if (attempts === 1) {
          response.writeHead(503).end();
        } else if (attempts === 2) {
          response.writeHead(200, { 'content-length': archive.length });
          response.flushHeaders();
          response.write(archive.subarray(0, 10));
          setImmediate(() => response.destroy());
        } else {
          response.end(archive);
        }
      } else {
        respondWithPackage(
          response,
          `${serverUrl(registry)}/cli.tgz`,
          `sha512-${createHash('sha512').update(archive).digest('base64')}`,
        );
      }
    });
    try {
      const fixture = path.join(temp, 'fixture');
      const binDir = path.join(fixture, 'package', 'bin');
      await mkdir(binDir, { recursive: true });
      await writeFile(path.join(binDir, binaryName()), 'fixture binary');
      const archiveFile = path.join(temp, 'package.tgz');
      execFileSync('tar', ['-czf', archiveFile, '-C', fixture, 'package']);
      archive = await readFile(archiveFile);
      vi.stubEnv('RUNNER_TEMP', temp);
      vi.stubEnv('RUNNER_TOOL_CACHE', path.join(temp, 'tool-cache'));
      vi.stubEnv('PATH', process.env.PATH ?? '');
      const realToolCache = await vi.importActual<typeof import('@actions/tool-cache')>('@actions/tool-cache');
      vi.mocked(tc.extractTar).mockImplementation(realToolCache.extractTar);
      vi.mocked(tc.cacheDir).mockImplementation(realToolCache.cacheDir);
      await listen(registry);

      const installed = await installFrom(serverUrl(registry), 'test-token');

      expect(await readFile(installed, 'utf8')).toBe('fixture binary');
      expect(attempts).toBe(3);
      expect(received).toEqual(Array(4).fill('Bearer test-token'));
    } finally {
      await close(registry);
      await rm(temp, { recursive: true, force: true });
    }
  }, 15_000);

  it('rejects an authenticated download whose integrity does not match', async () => {
    const registry = createServer((request, response) => {
      if (request.url === '/cli.tgz') {
        response.end('tampered archive');
      } else {
        respondWithPackage(
          response,
          `${serverUrl(registry)}/cli.tgz`,
          `sha512-${createHash('sha512').update('expected archive').digest('base64')}`,
        );
      }
    });
    try {
      await listen(registry);
      await expect(installFrom(serverUrl(registry), 'test-token')).rejects.toThrow('Integrity check failed');
      expect(tc.extractTar).not.toHaveBeenCalled();
    } finally {
      await close(registry);
    }
  });

  it('uses the configured proxy after a cross-origin redirect without forwarding the token', async () => {
    const received: (string | undefined)[] = [];
    const connections: (string | undefined)[] = [];
    const sockets: Duplex[] = [];
    const destination = createServer((request, response) => {
      received.push(request.headers.authorization);
      response.end('tarball');
    });
    const proxy = createServer();
    proxy.on('connect', (request, socket, head) => {
      connections.push(request.url);
      const address = destination.address();
      if (!address || typeof address === 'string') throw new Error('Expected a listening TCP server');
      const upstream = connect(address.port, '127.0.0.1');
      sockets.push(socket, upstream);
      socket.on('error', () => upstream.destroy());
      upstream.on('error', () => socket.destroy());
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      socket.pipe(upstream);
      upstream.pipe(socket);
    });
    const registry = createServer((request, response) => {
      received.push(request.headers.authorization);
      if (request.url === '/cli.tgz') {
        const address = destination.address();
        if (!address || typeof address === 'string') throw new Error('Expected a listening TCP server');
        response.writeHead(302, { location: `http://cdn.invalid:${address.port}/cli.tgz` }).end();
      } else {
        respondWithPackage(response, `${serverUrl(registry)}/cli.tgz`);
      }
    });
    try {
      await listen(destination);
      await listen(proxy);
      await listen(registry);
      vi.stubEnv('http_proxy', serverUrl(proxy));
      vi.stubEnv('HTTP_PROXY', serverUrl(proxy));
      vi.stubEnv('no_proxy', '127.0.0.1');
      vi.stubEnv('NO_PROXY', '127.0.0.1');
      const extractionError = new Error('stop before extraction');
      vi.mocked(tc.extractTar).mockRejectedValue(extractionError);

      await expect(installFrom(serverUrl(registry), 'test-token')).rejects.toBe(extractionError);

      const address = destination.address();
      if (!address || typeof address === 'string') throw new Error('Expected a listening TCP server');
      expect(connections).toEqual([`cdn.invalid:${address.port}`]);
      expect(received).toEqual(['Bearer test-token', 'Bearer test-token', undefined]);
    } finally {
      sockets.forEach((socket) => socket.destroy());
      await Promise.all([close(registry), close(proxy), close(destination)]);
    }
  });
});

describe('platformSuffix', () => {
  it.each([
    ['linux', 'x64', false, 'linux-x64'],
    ['linux', 'arm64', false, 'linux-arm64'],
    ['linux', 'x64', true, 'linux-x64-musl'],
    ['linux', 'arm64', true, 'linux-arm64-musl'],
    ['darwin', 'x64', false, 'darwin-x64'],
    ['darwin', 'arm64', false, 'darwin-arm64'],
    ['win32', 'x64', false, 'win32-x64'],
  ] as const)('%s %s musl=%s -> %s', (platform, arch, musl, expected) => {
    expect(platformSuffix(platform, arch, musl)).toBe(expected);
  });

  it('rejects unsupported platforms', () => {
    expect(() => platformSuffix('win32', 'arm64', false)).toThrow(/does not provide a native binary/);
    expect(() => platformSuffix('freebsd', 'x64', false)).toThrow(/use_installed_cli/);
  });
});

describe('binaryName', () => {
  it('adds .exe on Windows', () => {
    expect(binaryName('win32')).toBe('crowdin.exe');
    expect(binaryName('linux')).toBe('crowdin');
  });
});

describe('resolveVersion', () => {
  const packument = {
    'dist-tags': { latest: '5.5.0', next: '5.0.0-next.6' },
    versions: {
      '5.4.0': { version: '5.4.0', dist: { tarball: 'a' } },
      '5.5.0': { version: '5.5.0', dist: { tarball: 'b' } },
      '5.0.0-next.6': { version: '5.0.0-next.6', dist: { tarball: 'c' } },
    },
  };

  it('resolves exact versions (with optional v prefix)', () => {
    expect(resolveVersion(packument, '5.4.0').version).toBe('5.4.0');
    expect(resolveVersion(packument, 'v5.4.0').version).toBe('5.4.0');
  });

  it('resolves dist-tags', () => {
    expect(resolveVersion(packument, 'latest').version).toBe('5.5.0');
    expect(resolveVersion(packument, 'next').version).toBe('5.0.0-next.6');
  });

  it('fails for unknown versions', () => {
    expect(() => resolveVersion(packument, '9.9.9')).toThrow(/not found/);
  });
});
