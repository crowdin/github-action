import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pushToBranch, setupCommitSigning } from '../src/git.js';
import type { Inputs } from '../src/inputs.js';

vi.mock('@actions/core', () => ({ info: vi.fn(), warning: vi.fn(), setSecret: vi.fn() }));

const hasGpg = (() => {
  try {
    execFileSync('gpg', ['--version'], { stdio: 'ignore' });
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
  const originalEnv = { ...process.env };

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
    process.env.GIT_CONFIG_KEY_0 = `url.${remote}.insteadOf`;
    process.env.GIT_CONFIG_VALUE_0 = 'https://bot:secret-token@github.com/octo/repo.git';
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.env = { ...originalEnv };
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
  });

  it('requires a GitHub token', async () => {
    delete process.env.GITHUB_TOKEN;
    await expect(pushToBranch(inputs())).rejects.toThrow(/GITHUB_TOKEN/);
  });
});
