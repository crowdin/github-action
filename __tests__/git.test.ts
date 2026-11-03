import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pushToBranch, setupCommitSigning } from '../src/git.js';
import type { Inputs } from '../src/inputs.js';

vi.mock('@actions/core', () => ({ info: vi.fn(), warning: vi.fn(), setSecret: vi.fn() }));
vi.mock('@actions/exec', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@actions/exec')>();
  return { ...actual, exec: vi.fn(actual.exec), getExecOutput: vi.fn(actual.getExecOutput) };
});

const hasGpg = (() => {
  try {
    execFileSync('gpg', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const hasGitLfs = (() => {
  try {
    execFileSync('git', ['lfs', 'version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const run = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

describe('pushToBranch', () => {
  let tmp: string;
  let work: string;
  let remote: string;
  const originalCwd = process.cwd();
  const envKeys = [
    'GITHUB_TOKEN',
    'GH_TOKEN',
    'GITHUB_ACTOR',
    'GITHUB_REPOSITORY',
    'GITHUB_REF',
    'GITHUB_HEAD_REF',
    'GIT_CONFIG_COUNT',
    'GIT_CONFIG_KEY_0',
    'GIT_CONFIG_VALUE_0',
  ];
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'crowdin-git-'));
    remote = path.join(tmp, 'remote.git');
    work = path.join(tmp, 'work');

    run(tmp, 'init', '--bare', '-b', 'main', remote);
    run(tmp, 'init', '-b', 'main', work);
    run(work, 'config', 'user.name', 'Test');
    run(work, 'config', 'user.email', 'test@example.com');
    run(work, 'config', 'commit.gpgsign', 'false');
    writeFileSync(path.join(work, 'README.md'), 'hello\n');
    run(work, 'add', '.');
    run(work, 'commit', '-m', 'init');
    run(work, 'remote', 'add', 'origin', remote);
    run(work, 'push', 'origin', 'main');

    process.chdir(work);
    process.env.GITHUB_TOKEN = 'secret-token';
    process.env.GITHUB_ACTOR = 'bot';
    process.env.GITHUB_REPOSITORY = 'octo/repo';
    process.env.GITHUB_REF = 'refs/heads/main';
    delete process.env.GITHUB_HEAD_REF;
    delete process.env.GH_TOKEN;
    // Redirect the authenticated GitHub URL to the local bare repository.
    process.env.GIT_CONFIG_COUNT = '1';
    process.env.GIT_CONFIG_KEY_0 = `url.${pathToFileURL(remote).href}.insteadOf`;
    process.env.GIT_CONFIG_VALUE_0 = 'https://bot:secret-token@github.com/octo/repo.git';
  });

  afterEach(() => {
    vi.resetAllMocks();
    process.chdir(originalCwd);
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(tmp, { recursive: true, force: true });
  });

  const inputs = (overrides: Partial<Inputs> = {}): Inputs =>
    ({
      localizationBranchName: 'l10n_crowdin_action',
      githubBaseUrl: 'github.com',
      githubUserName: 'Crowdin Bot',
      githubUserEmail: 'support+bot@crowdin.com',
      commitMessage: 'New Crowdin translations',
      skipRefCheckout: false,
      createPullRequest: false,
      ...overrides,
    }) as Inputs;

  function trackLfsFiles(): void {
    run(work, 'lfs', 'install', '--local');
    run(work, 'lfs', 'track', '*.xlsx');
    run(work, 'add', '.gitattributes');
    run(work, 'commit', '-m', 'Track spreadsheets with LFS');
    run(work, 'push', 'origin', 'main');
  }

  it('commits changes to the localization branch, pushes and restores the checkout', async () => {
    writeFileSync(path.join(work, 'uk.json'), '{"hello":"привіт"}\n');

    await pushToBranch(inputs());

    expect(run(work, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
    expect(run(remote, 'log', '-1', '--format=%s|%an|%ae', 'l10n_crowdin_action')).toBe(
      'New Crowdin translations|Crowdin Bot|support+bot@crowdin.com',
    );
    expect(run(remote, 'show', 'l10n_crowdin_action:uk.json')).toContain('привіт');
    // Identity must not leak into the repository or global configuration.
    expect(run(work, 'config', '--local', 'user.name')).toBe('Test');
  });

  it('builds on top of the existing remote localization branch', async () => {
    writeFileSync(path.join(work, 'uk.json'), '1\n');
    await pushToBranch(inputs());
    writeFileSync(path.join(work, 'de.json'), '2\n');
    await pushToBranch(inputs());

    expect(run(remote, 'rev-list', '--count', 'l10n_crowdin_action')).toBe('3');
  });

  it('does not push when there is nothing to commit', async () => {
    await pushToBranch(inputs());
    expect(() => run(remote, 'rev-parse', '--verify', 'l10n_crowdin_action')).toThrow();
    expect(run(work, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
  });

  it.skipIf(!hasGitLfs)('skips the LFS push when the commit contains no LFS files', async () => {
    writeFileSync(path.join(work, 'uk.json'), '{}\n');

    await pushToBranch(inputs());

    expect(exec.getExecOutput).toHaveBeenCalledWith('git', ['lfs', 'ls-files'], expect.any(Object));
    expect(vi.mocked(exec.exec).mock.calls.some(([command, args]) => command === 'git' && args?.[0] === 'lfs' && args[1] === 'push')).toBe(false);
    expect(run(remote, 'show', 'l10n_crowdin_action:uk.json')).toBe('{}');
  });

  it.skipIf(!hasGitLfs)('uploads LFS objects before pushing the localization branch', async () => {
    trackLfsFiles();
    const contents = Buffer.from('translated spreadsheet contents\n');
    const oid = createHash('sha256').update(contents).digest('hex');
    writeFileSync(path.join(work, 'uk.xlsx'), contents);
    const actual = await vi.importActual<typeof import('@actions/exec')>('@actions/exec');
    vi.mocked(exec.exec).mockImplementation((command, args, options) => {
      if (command === 'git' && args?.[0] === 'lfs' && args[1] === 'push') {
        return actual.exec(command, [args[0], args[1], pathToFileURL(remote).href, ...args.slice(3)], options);
      }
      return actual.exec(command, args, options);
    });

    const objectPath = `lfs/objects/${oid.slice(0, 2)}/${oid.slice(2, 4)}/${oid}`;
    writeFileSync(
      path.join(remote, 'hooks', 'pre-receive'),
      `#!/bin/sh\nif [ ! -f "${objectPath}" ]; then\n  echo "Missing Git LFS object" >&2\n  exit 1\nfi\n`,
      { mode: 0o755 },
    );

    await pushToBranch(inputs());

    const calls = vi.mocked(exec.exec).mock.calls;
    const lfsPush = calls.findIndex(([command, args]) => command === 'git' && args?.[0] === 'lfs' && args[1] === 'push');
    const gitPush = calls.findIndex(([command, args]) => command === 'git' && args?.[0] === 'push');
    expect(lfsPush).toBeGreaterThanOrEqual(0);
    expect(gitPush).toBeGreaterThan(lfsPush);
    expect(calls[lfsPush][1]?.[2]).toBe(calls[gitPush][1]?.[3]);
    expect(existsSync(path.join(remote, objectPath))).toBe(true);
    expect(run(remote, 'show', 'l10n_crowdin_action:uk.xlsx')).toContain(`oid sha256:${oid}`);
    expect(run(work, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
  });

  it.skipIf(!hasGitLfs)('does not push the branch if uploading LFS objects fails', async () => {
    trackLfsFiles();
    writeFileSync(path.join(work, 'uk.xlsx'), 'translated spreadsheet contents\n');
    const realExec = await vi.importActual<typeof import('@actions/exec')>('@actions/exec');
    vi.mocked(exec.exec).mockImplementation((command, args, options) => {
      if (command === 'git' && args?.[0] === 'lfs' && args[1] === 'push') {
        return Promise.reject(new Error('LFS upload failed'));
      }
      return realExec.exec(command, args, options);
    });

    await expect(pushToBranch(inputs())).rejects.toThrow('LFS upload failed');

    expect(vi.mocked(exec.exec).mock.calls.some(([command, args]) => command === 'git' && args?.[0] === 'push')).toBe(false);
    expect(() => run(remote, 'rev-parse', '--verify', 'l10n_crowdin_action')).toThrow();
    expect(run(work, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
  });

  it('continues without Git LFS when it is not installed', async () => {
    const actual = await vi.importActual<typeof import('@actions/exec')>('@actions/exec');
    vi.mocked(exec.getExecOutput).mockImplementation((command, args, options) => {
      if (command === 'git' && args?.[0] === 'lfs' && args[1] === 'ls-files') {
        return Promise.resolve({ exitCode: 1, stdout: '', stderr: "git: 'lfs' is not a git command. See 'git --help'.\n" });
      }
      return actual.getExecOutput(command, args, options);
    });
    writeFileSync(path.join(work, 'uk.json'), '{}\n');

    await pushToBranch(inputs());

    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Git LFS is not installed'));
    expect(run(remote, 'show', 'l10n_crowdin_action:uk.json')).toBe('{}');
  });

  it('reports unexpected failures when inspecting Git LFS files', async () => {
    const actual = await vi.importActual<typeof import('@actions/exec')>('@actions/exec');
    vi.mocked(exec.getExecOutput).mockImplementation((command, args, options) => {
      if (command === 'git' && args?.[0] === 'lfs' && args[1] === 'ls-files') {
        return Promise.resolve({ exitCode: 1, stdout: '', stderr: 'Failed to inspect LFS files' });
      }
      return actual.getExecOutput(command, args, options);
    });
    writeFileSync(path.join(work, 'uk.json'), '{}\n');

    await expect(pushToBranch(inputs())).rejects.toThrow('Failed to inspect LFS files');
    expect(() => run(remote, 'rev-parse', '--verify', 'l10n_crowdin_action')).toThrow();
    expect(run(work, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
  });

  it.skipIf(!hasGpg)('signs commits with an imported GPG key without touching the default keyring', async () => {
    const keyHome = mkdtempSync(path.join(tmp, 'keygen-'));
    const gpg = (...args: string[]) =>
      execFileSync('gpg', ['--batch', '--homedir', keyHome, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    gpg('--passphrase', 'pw', '--pinentry-mode', 'loopback', '--quick-gen-key', 'Crowdin Bot <support+bot@crowdin.com>', 'ed25519', 'sign', '0');
    const armored = gpg('--passphrase', 'pw', '--pinentry-mode', 'loopback', '--armor', '--export-secret-keys');
    execFileSync('gpgconf', ['--homedir', keyHome, '--kill', 'gpg-agent']);

    const config = inputs({ gpgPrivateKey: armored, gpgPassphrase: 'pw' });
    const signing = await setupCommitSigning(config);
    try {
      writeFileSync(path.join(work, 'uk.json'), '{}\n');
      await pushToBranch(config, signing);
      expect(run(remote, 'cat-file', '-p', 'l10n_crowdin_action')).toContain('-----BEGIN PGP SIGNATURE-----');
    } finally {
      await signing.cleanup();
    }
    expect(existsSync(signing.env.GNUPGHOME)).toBe(false);
  }, 30_000);

  it('requires a GitHub token', async () => {
    delete process.env.GITHUB_TOKEN;
    await expect(pushToBranch(inputs())).rejects.toThrow(/GITHUB_TOKEN/);
  });
});
