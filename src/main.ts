import * as core from '@actions/core';
import * as exec from '@actions/exec';
import {
  customCommandArgs,
  downloadBundleArgs,
  downloadSourcesArgs,
  downloadTranslationsArgs,
  uploadSourcesArgs,
  uploadTranslationsArgs,
} from './args.js';
import { installCli } from './cli.js';
import { pushToBranch, setupCommitSigning, type GpgSigning } from './git.js';
import { readInputs, type Inputs } from './inputs.js';
import type { PullRequestResult } from './pull-request.js';

function setPullRequestOutputs(result: PullRequestResult | undefined): void {
  if (!result?.created) return;
  core.setOutput('pull_request_url', result.url ?? '');
  core.setOutput('pull_request_number', result.number?.toString() ?? '');
  core.setOutput('pull_request_created', 'true');
}

export async function run(): Promise<void> {
  core.setOutput('pull_request_url', '');
  core.setOutput('pull_request_number', '');
  core.setOutput('pull_request_created', 'false');
  core.setOutput('command_output', '');

  const inputs = readInputs();
  if (inputs.token) core.setSecret(inputs.token);
  if (inputs.gpgPassphrase) core.setSecret(inputs.gpgPassphrase);

  core.info('STARTING CROWDIN ACTION');

  const workspace = process.env.GITHUB_WORKSPACE;
  if (workspace) process.chdir(workspace);

  const crowdin = await installCli({
    version: inputs.cliVersion,
    registryUrl: inputs.npmRegistryUrl,
    useInstalled: inputs.useInstalledCli,
  });

  if (inputs.command) {
    const args = customCommandArgs(inputs);
    core.info(`RUNNING COMMAND crowdin ${args.join(' ')}`);
    const { stdout } = await exec.getExecOutput(crowdin, args);
    core.setOutput('command_output', stdout.replace(/\r?\n$/, ''));
    return;
  }

  let signing: GpgSigning | undefined;
  const push = async (): Promise<void> => {
    if (inputs.gpgPrivateKey && !signing) signing = await setupCommitSigning(inputs);
    setPullRequestOutputs(await pushToBranch(inputs, signing));
  };

  try {
    await runCommands(inputs, crowdin, push);
  } finally {
    await signing?.cleanup();
  }
}

async function runCommands(inputs: Inputs, crowdin: string, push: () => Promise<void>): Promise<void> {
  if (inputs.uploadSources) {
    core.info('UPLOAD SOURCES');
    await exec.exec(crowdin, uploadSourcesArgs(inputs));
  }

  if (inputs.uploadTranslations) {
    core.info('UPLOAD TRANSLATIONS');
    await exec.exec(crowdin, uploadTranslationsArgs(inputs));
  }

  if (inputs.downloadSources) {
    core.info('DOWNLOAD SOURCES');
    await exec.exec(crowdin, downloadSourcesArgs(inputs));
    if (inputs.pushSources) await push();
  }

  if (inputs.downloadTranslations) {
    core.info('DOWNLOAD TRANSLATIONS');
    await exec.exec(crowdin, downloadTranslationsArgs(inputs));
    if (inputs.pushTranslations) await push();
  }

  if (inputs.downloadBundle) {
    core.info(`DOWNLOADING BUNDLE ${inputs.downloadBundle}`);
    await exec.exec(crowdin, downloadBundleArgs(inputs));
    if (inputs.pushTranslations) await push();
  }
}
