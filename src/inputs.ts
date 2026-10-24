import * as core from '@actions/core';

/** Crowdin CLI version installed when `cli_version` is not set. Keep in sync with action.yml. */
export const DEFAULT_CLI_VERSION = '5.5.0';

export interface Inputs {
  uploadSources: boolean;
  uploadSourcesArgs: string;

  uploadTranslations: boolean;
  uploadLanguage: string;
  autoApproveImported: boolean;
  importEqSuggestions: boolean;
  uploadTranslationsArgs: string;

  downloadSources: boolean;
  pushSources: boolean;
  downloadSourcesArgs: string;

  downloadTranslations: boolean;
  downloadLanguage: string;
  /** Legacy `language` input kept for backward compatibility. */
  language: string;
  downloadBundle: string;
  skipUntranslatedStrings: boolean;
  skipUntranslatedFiles: boolean;
  exportOnlyApproved: boolean;
  pushTranslations: boolean;
  commitMessage: string;
  localizationBranchName: string;
  createPullRequest: boolean;
  pullRequestTitle: string;
  pullRequestBody: string;
  pullRequestAssignees: string;
  pullRequestReviewers: string;
  pullRequestTeamReviewers: string;
  pullRequestLabels: string;
  pullRequestBaseBranchName: string;
  downloadTranslationsArgs: string;
  skipRefCheckout: boolean;

  crowdinBranchName: string;
  config: string;
  dryrunAction: boolean;

  githubBaseUrl: string;
  githubApiBaseUrl: string;
  githubUserName: string;
  githubUserEmail: string;
  gpgPrivateKey: string;
  gpgPassphrase: string;

  projectId: string;
  token: string;
  baseUrl: string;
  basePath: string;
  source: string;
  translation: string;

  command: string;
  commandArgs: string;

  cliVersion: string;
  useInstalledCli: boolean;
  npmRegistryUrl: string;

  debugMode: boolean;
}

const str = (name: string, fallback = ''): string => core.getInput(name) || fallback;
const bool = (name: string): boolean => core.getInput(name).trim().toLowerCase() === 'true';

export function readInputs(): Inputs {
  return {
    uploadSources: bool('upload_sources'),
    uploadSourcesArgs: str('upload_sources_args'),

    uploadTranslations: bool('upload_translations'),
    uploadLanguage: str('upload_language'),
    autoApproveImported: bool('auto_approve_imported'),
    importEqSuggestions: bool('import_eq_suggestions'),
    uploadTranslationsArgs: str('upload_translations_args'),

    downloadSources: bool('download_sources'),
    pushSources: bool('push_sources'),
    downloadSourcesArgs: str('download_sources_args'),

    downloadTranslations: bool('download_translations'),
    downloadLanguage: str('download_language'),
    language: str('language'),
    downloadBundle: str('download_bundle'),
    skipUntranslatedStrings: bool('skip_untranslated_strings'),
    skipUntranslatedFiles: bool('skip_untranslated_files'),
    exportOnlyApproved: bool('export_only_approved'),
    pushTranslations: bool('push_translations'),
    commitMessage: str('commit_message', 'New Crowdin translations by GitHub Action'),
    localizationBranchName: str('localization_branch_name', 'l10n_crowdin_action'),
    createPullRequest: bool('create_pull_request'),
    pullRequestTitle: str('pull_request_title', 'New Crowdin translations by GitHub Action'),
    pullRequestBody: str('pull_request_body'),
    pullRequestAssignees: str('pull_request_assignees'),
    pullRequestReviewers: str('pull_request_reviewers'),
    pullRequestTeamReviewers: str('pull_request_team_reviewers'),
    pullRequestLabels: str('pull_request_labels'),
    pullRequestBaseBranchName: str('pull_request_base_branch_name'),
    downloadTranslationsArgs: str('download_translations_args'),
    skipRefCheckout: bool('skip_ref_checkout'),

    crowdinBranchName: str('crowdin_branch_name'),
    config: str('config'),
    dryrunAction: bool('dryrun_action'),

    githubBaseUrl: str('github_base_url', 'github.com'),
    githubApiBaseUrl: str('github_api_base_url'),
    githubUserName: str('github_user_name', 'Crowdin Bot'),
    githubUserEmail: str('github_user_email', 'support+bot@crowdin.com'),
    gpgPrivateKey: str('gpg_private_key'),
    gpgPassphrase: str('gpg_passphrase'),

    projectId: str('project_id'),
    token: str('token'),
    baseUrl: str('base_url'),
    basePath: str('base_path'),
    source: str('source'),
    translation: str('translation'),

    command: str('command'),
    commandArgs: str('command_args'),

    cliVersion: str('cli_version', DEFAULT_CLI_VERSION).trim(),
    useInstalledCli: bool('use_installed_cli'),
    npmRegistryUrl: str('npm_registry_url', 'https://registry.npmjs.org').trim(),

    debugMode: bool('debug_mode') || Boolean(process.env.RUNNER_DEBUG),
  };
}
