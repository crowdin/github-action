import { describe, expect, it } from 'vitest';
import { binaryName, platformSuffix, resolveVersion } from '../src/cli.js';

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
