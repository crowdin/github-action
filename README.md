<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://support.crowdin.com/assets/logos/symbol/png/crowdin-symbol-cWhite.png">
    <source media="(prefers-color-scheme: light)" srcset="https://support.crowdin.com/assets/logos/symbol/png/crowdin-symbol-cDark.png">
    <img width="150" height="150" width=""src="https://support.crowdin.com/assets/logos/symbol/png/crowdin-symbol-cDark.png">
  </picture>
</p>

# GitHub Crowdin Action [![Tweet](https://img.shields.io/twitter/url/http/shields.io.svg?style=social)](https://twitter.com/intent/tweet?url=https%3A%2F%2Fgithub.com%2Fcrowdin%2Fgithub-action&text=Easily%20integrate%20the%20localization%20of%20your%20Crowdin%20project%20into%20the%20GitHub%20Actions%20workflow)&nbsp;[![GitHub Repo stars](https://img.shields.io/github/stars/crowdin/github-action?style=social&cacheSeconds=1800)](https://github.com/crowdin/github-action/stargazers)

A GitHub action to manage and synchronize localization resources with your Crowdin project

<div align="center">

[**`Examples`**](/EXAMPLES.md) |
[**`How to Set Up (video)`**](https://www.youtube.com/watch?v=5b7BMuCoKGg) |
[**`Configuration File`**](https://developer.crowdin.com/configuration-file/) |
[**`Wiki`**](https://github.com/crowdin/github-action/wiki)

[![test](https://github.com/crowdin/github-action/actions/workflows/test-action.yml/badge.svg)](https://github.com/crowdin/github-action/actions/workflows/test-action.yml)
[![GitHub Used by](https://img.shields.io/static/v1?label=Used%20by&message=8k&color=brightgreen&logo=github&cacheSeconds=10000)](https://github.com/crowdin/github-action/network/dependents?package_id=UGFja2FnZS0yOTQyNTU3MzA0)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/crowdin/github-action?cacheSeconds=5000&logo=github)](https://github.com/crowdin/github-action/releases/latest)
[![GitHub contributors](https://img.shields.io/github/contributors/crowdin/github-action?cacheSeconds=5000)](https://github.com/crowdin/github-action/graphs/contributors)
[![GitHub](https://img.shields.io/github/license/crowdin/github-action?cacheSeconds=50000)](https://github.com/crowdin/github-action/blob/master/LICENSE)

</div>

## What does this action do?

This action allows you to easily integrate and automate the localization of your Crowdin project into the GitHub Actions workflow.

- Upload sources to Crowdin.
- Upload translations to Crowdin.
- Downloads translations from Crowdin.
- Download sources from Crowdin.
- Creates a PR with the translations.
- Run any Crowdin CLI command.

## Usage

Set up a workflow in *.github/workflows/crowdin.yml* (or add a job to your existing workflows).

Read the [Configuring a workflow](https://help.github.com/en/articles/configuring-a-workflow) article for more details on creating and setting up GitHub workflows.

```yaml
name: Crowdin Action

on:
  push:
    branches: [ main ]

jobs:
  synchronize-with-crowdin:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: crowdin action
        uses: crowdin/github-action@v1
        with:
          upload_sources: true
          upload_translations: false
          download_translations: true
          localization_branch_name: l10n_crowdin_translations
          create_pull_request: true
          pull_request_title: 'New Crowdin Translations'
          pull_request_body: 'New Crowdin translations by [Crowdin GH Action](https://github.com/crowdin/github-action)'
          pull_request_base_branch_name: 'main'
        env:
          GITHUB_TOKEN: ${{ secrets.GH_TOKEN }}
          CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
          CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
```

`secrets.GH_TOKEN` - a GitHub Personal Access Token with the `repo` scope selected (the user should have write access to the repository).

## Supported options

The default action is to upload sources. However, you can set different actions using the "with" options. If you don't want to upload your sources to Crowdin, just set the `upload_sources` option to false.

By default, sources and translations are being uploaded to the root of your Crowdin project. Still, if you use branches, you can set the preferred source branch.

You can also specify what GitHub branch you’d like to download your translations to (default translation branch is `l10n_crowdin_action`).

In case you don’t want to download translations from Crowdin (`download_translations: false`), `localization_branch_name` and `create_pull_request` options aren't required either.

```yaml
- name: crowdin action
  uses: crowdin/github-action@v1
  with:
    # Upload sources option
    upload_sources: true
    # This can be used to pass down any supported argument of the `upload sources` cli command, e.g.
    upload_sources_args: '--no-auto-update label=web'

    # Upload translations options
    upload_translations: false
    upload_language: 'uk'
    auto_approve_imported: true
    import_eq_suggestions: true
    # This can be used to pass down any supported argument of the `upload translations` cli command, e.g.
    #upload_translations_args: '--auto-approve-imported --translate-hidden'

    # Download sources options
    download_sources: true
    push_sources: true
    # this can be used to pass down any supported argument of the `download sources` cli command, e.g.
    download_sources_args: '--reviewed'

    # Download translations options
    download_translations: true
    download_language: 'uk'
    skip_untranslated_strings: true
    skip_untranslated_files: true
    export_only_approved: true
    push_translations: true
    commit_message: 'New Crowdin translations by GitHub Action'
    # this can be used to pass down any supported argument of the `download translations` cli command, e.g.
    download_translations_args: '--all --skip-untranslated-strings'

    # This is the name of the git branch that Crowdin will create when opening a pull request.
    # This branch does NOT need to be manually created. It will be created automatically by the action.
    localization_branch_name: l10n_crowdin_action
    create_pull_request: true
    pull_request_title: 'New Crowdin translations'
    pull_request_body: 'New Crowdin pull request with translations'
    pull_request_labels: 'enhancement, good first issue'
    pull_request_assignees: 'crowdin-bot'
    pull_request_reviewers: 'crowdin-user-reviewer'
    pull_request_team_reviewers: 'crowdin-team-reviewer'

    # This is the name of the git branch to with pull request will be created.
    # If not specified default repository branch will be used.
    pull_request_base_branch_name: not_default_branch

    # Global options

    # This is the name of the top-level directory that Crowdin will use for files.
    # Note that this is not a "branch" in the git sense, but more like a top-level directory in your Crowdin project.
    # This branch does NOT need to be manually created. It will be created automatically by the action.
    crowdin_branch_name: l10n_branch
    identity: 'path/to/your/credentials/file'
    config: 'path/to/your/crowdin.yml'
    dryrun_action: true

    # GitHub (Enterprise) configuration
    github_base_url: github.com
    github_api_base_url: api.[github_base_url]
    github_user_name: Crowdin Bot
    github_user_email: support+bot@crowdin.com
    
    # For signed commits, add your ASCII-armored key and export "gpg --armor --export-secret-key GPG_KEY_ID"
    # Ensure that all emails are the same: for account profile that holds private key, the one specified during key generation, and for commit author (github_user_email parameter)
    gpg_private_key: ${{ secrets.GPG_PRIVATE_KEY }}
    gpg_passphrase: ${{ secrets.GPG_PASSPHRASE }}

    # Config options
    token: ${{ secrets.CROWDIN_PERSONAL_TOKEN }} # A Personal Access Token (see https://crowdin.com/settings#api-key)
    project_id: ${{ secrets.CROWDIN_PROJECT_ID }} # The numeric project ID. Visit the Tools > API section in your Crowdin project
    source: 'path/to/your/file'
    translation: 'file/export/pattern'
    base_url: 'https://api.crowdin.com'
    base_path: 'project-base-path' # Default: '.'
```

For more detailed descriptions of these options, see [`action.yml`](https://github.com/crowdin/github-action/blob/master/action.yml).

> **Note**
> The `base_url` is required For Crowdin Enterprise and should be passed in the following way: `base_url: 'https://{organization-name}.api.crowdin.com'`

### Crowdin CLI command

You can also run any other Crowdin CLI command by specifying the `command` and `command_args` _(optional)_ options. For example:

```yaml
- name: crowdin action
  uses: crowdin/github-action@v1
  with:
    command: 'pre-translate'
    command_args: '-l uk --method tm --branch main'
```

To see the full list of available commands, visit the [official documentation](https://crowdin.github.io/crowdin-cli/).

### Crowdin configuration file

If your workflow file specifies the `config` property, you'll need to add the following to your [Crowdin configuration file](https://support.crowdin.com/configuration-file/) (e.g. `crowdin.yml`):

```yml
project_id_env: CROWDIN_PROJECT_ID
api_token_env: CROWDIN_PERSONAL_TOKEN
```

When the workflow runs, the real values of your token and project ID will be injected into the config using the secrets in the environment.

## Permissions

In order to push translations and create pull requests, the Crowdin GitHub Action requires the `GITHUB_TOKEN` to have the write permission on the `content` and `pull-requests`.

In case you want to use an [automatic GitHub authentication token](https://docs.github.com/en/actions/security-guides/automatic-token-authentication), you need to assign the [`write` permission to your job](https://docs.github.com/en/actions/using-jobs/assigning-permissions-to-jobs) and [allow GH Actions to create Pull Requests](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#preventing-github-actions-from-creating-or-approving-pull-requests).

## Contributing

If you would like to contribute please read the [Contributing](/CONTRIBUTING.md) guidelines.

## Seeking Assistance

If you find any problems or would like to suggest a feature, please feel free to file an issue on GitHub at [Issues Page](https://github.com/crowdin/github-action/issues).

## License

<pre>
The Crowdin GitHub Action is licensed under the MIT License.
See the LICENSE file distributed with this work for additional
information regarding copyright ownership.

Except as contained in the LICENSE file, the name(s) of the above copyright
holders shall not be used in advertising or otherwise to promote the sale,
use or other dealings in this Software without prior written authorization.
</pre>
