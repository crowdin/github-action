import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Inputs } from './inputs.js';
import { createPullRequest, type PullRequestResult } from './pull-request.js';

export interface GpgSigning {
  keyId: string;
  /** Environment for git so that it uses the isolated GPG home with the imported key. */
  env: Record<string, string>;
  cleanup: () => Promise<void>;
}

async function git(args: string[], options: exec.ExecOptions = {}): Promise<number> {
  return exec.exec('git', args, options);
}

async function gitOutput(args: string[], options: exec.ExecOptions = {}): Promise<exec.ExecOutput> {
  return exec.getExecOutput('git', args, { silent: true, ignoreReturnCode: true, ...options });
}

export function resolveAuthToken(env = process.env): string {
  const token = env.GH_TOKEN || env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("Either 'GITHUB_TOKEN' or 'GH_TOKEN' must be set in the environment variables!");
  }
  return token;
}

/** The ref checked out before pushing, unless `skip_ref_checkout` is set. */
export function checkoutRef(env = process.env): string {
  return (env.GITHUB_HEAD_REF || env.GITHUB_REF || '').replace(/^refs\/heads\//, '').replace(/^refs\/tags\//, '');
}

function stringEnv(extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  return { ...env, ...extra };
}

/**
 * Imports the GPG private key into an isolated, temporary GNUPGHOME so the runner's own
 * keyring is never modified, and caches the passphrase in the agent for `git commit -S`.
 */
export async function setupCommitSigning(inputs: Inputs): Promise<GpgSigning> {
  core.info('FOUND PRIVATE KEY, WILL SETUP GPG KEYSTORE');

  const tempRoot = process.env.RUNNER_TEMP || os.tmpdir();
  const home = await mkdtemp(path.join(tempRoot, 'crowdin-gpg-'));
  const env = stringEnv({ GNUPGHOME: home });
  const keyFile = path.join(home, 'private.key');

  const cleanup = async (): Promise<void> => {
    await exec.exec('gpgconf', ['--kill', 'gpg-agent'], { env, ignoreReturnCode: true, silent: true }).catch(() => 0);
    await rm(home, { recursive: true, force: true });
  };

  try {
    await writeFile(keyFile, inputs.gpgPrivateKey, { mode: 0o600 });
    await exec.exec('gpg', ['--batch', '--import', keyFile], { env });
    await rm(keyFile, { force: true });

    const { stdout } = await exec.getExecOutput('gpg', ['--batch', '--with-colons', '--list-secret-keys'], {
      env,
      silent: true,
    });
    const records = stdout.split(/\r?\n/).map((line) => line.split(':'));
    const keyId = records.find((r) => r[0] === 'sec')?.[4];
    if (!keyId) throw new Error('No secret GPG key was found after import');

    const uid = records.find((r) => r[0] === 'uid')?.[9] ?? '';
    const match = /^(.*?)\s*<([^>]+)>/.exec(uid);
    core.info('Imported key information:');
    core.info(`      Key id: ${keyId}`);
    core.info(`  Owner name: ${match?.[1] ?? uid}`);
    core.info(` Owner email: ${match?.[2] ?? ''}`);

    // Sign once to cache the passphrase in the agent for the following `git commit`.
    const probe = path.join(home, 'probe.txt');
    await writeFile(probe, 'test');
    await exec.exec(
      'gpg',
      [
        '--batch',
        '--yes',
        '--pinentry-mode=loopback',
        '--passphrase-fd',
        '0',
        '--local-user',
        keyId,
        '--output',
        `${probe}.asc`,
        '--clearsign',
        probe,
      ],
      { env, input: Buffer.from(`${inputs.gpgPassphrase}\n`), silent: true },
    );

    return { keyId, env: { GNUPGHOME: home }, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

async function currentCheckout(): Promise<string | undefined> {
  const branch = await gitOutput(['symbolic-ref', '-q', '--short', 'HEAD']);
  if (branch.exitCode === 0 && branch.stdout.trim()) return branch.stdout.trim();
  const sha = await gitOutput(['rev-parse', '--verify', 'HEAD']);
  return sha.exitCode === 0 ? sha.stdout.trim() : undefined;
}

/**
 * Commits all changes in the workspace to the localization branch, pushes it and
 * (optionally) opens a pull request. Mirrors `push_to_branch` from the former entrypoint.sh.
 */
export async function pushToBranch(inputs: Inputs, signing?: GpgSigning): Promise<PullRequestResult | undefined> {
  const authToken = resolveAuthToken();
  core.setSecret(authToken);

  const branch = inputs.localizationBranchName;
  const actor = process.env.GITHUB_ACTOR ?? 'x-access-token';
  const repoUrl = `https://${encodeURIComponent(actor)}:${authToken}@${inputs.githubBaseUrl}/${process.env.GITHUB_REPOSITORY}.git`;

  // Identity and signing are passed per command so no global or repository git config is modified.
  const identity = ['-c', `user.name=${inputs.githubUserName}`, '-c', `user.email=${inputs.githubUserEmail}`];
  if (signing) identity.push('-c', `user.signingkey=${signing.keyId}`, '-c', 'commit.gpgsign=true');
  const commitEnv = signing ? stringEnv(signing.env) : undefined;

  const original = await currentCheckout();
  let result: PullRequestResult | undefined;
  let failure: unknown;

  try {
    if (!inputs.skipRefCheckout) {
      await git(['checkout', checkoutRef()]);
    }

    // Check out the localization branch, using the remote state if available.
    await git(['fetch', 'origin', branch], { ignoreReturnCode: true, silent: true });
    const fromRemote = await git(['checkout', '-B', branch, `origin/${branch}`], { ignoreReturnCode: true, silent: true });
    if (fromRemote !== 0) await git(['checkout', '-B', branch]);

    await git(['add', '.']);

    const status = await gitOutput(['status', '--porcelain']);
    if (!status.stdout.trim()) {
      core.info('NOTHING TO COMMIT');
    } else {
      core.info(`PUSH TO BRANCH ${branch}`);
      await git([...identity, 'commit', '--no-verify', '-m', inputs.commitMessage], { env: commitEnv });
      await git(['push', '--no-verify', '--force', repoUrl, `HEAD:refs/heads/${branch}`]);

      if (inputs.createPullRequest) {
        result = await createPullRequest(inputs, authToken, branch);
      }
    }
  } catch (error) {
    failure = error;
  }

  if (original) {
    core.info(`RESTORING ORIGINAL CHECKOUT: ${original}`);
    const restored = await git(['checkout', original], { ignoreReturnCode: true });
    if (restored !== 0 && !failure) failure = new Error(`Failed to restore the original checkout: ${original}`);
  }

  if (failure) throw failure;
  return result;
}
