<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://support.crowdin.com/assets/logos/symbol/png/crowdin-symbol-cWhite.png">
    <source media="(prefers-color-scheme: light)" srcset="https://support.crowdin.com/assets/logos/symbol/png/crowdin-symbol-cDark.png">
    <img width="150" height="150" src="https://support.crowdin.com/assets/logos/symbol/png/crowdin-symbol-cDark.png">
  </picture>
</p>

# GitHub Crowdin Action [![Share](https://img.shields.io/twitter/url/http/shields.io.svg?style=social)](https://twitter.com/intent/tweet?url=https%3A%2F%2Fgithub.com%2Fcrowdin%2Fgithub-action&text=Easily%20integrate%20the%20localization%20of%20your%20Crowdin%20project%20into%20the%20GitHub%20Actions%20workflow)&nbsp;[![GitHub Repo stars](https://img.shields.io/github/stars/crowdin/github-action?style=social&cacheSeconds=1800)](https://github.com/crowdin/github-action/stargazers)

A GitHub action to manage and synchronize localization resources with your Crowdin project

<div align="center">

[**`Examples`**](/docs/EXAMPLES.md) |
[**`How to Set Up (video)`**](https://www.youtube.com/watch?v=5b7BMuCoKGg) |
[**`Configuration File`**](https://developer.crowdin.com/configuration-file/) |
[**`AI Localization`**](/docs/AI.md)

[![test](https://github.com/crowdin/github-action/actions/workflows/test-action.yml/badge.svg)](https://github.com/crowdin/github-action/actions/workflows/test-action.yml)
[![GitHub Used by](https://img.shields.io/static/v1?label=Used%20by&message=10k&color=brightgreen&logo=github&cacheSeconds=10000)](https://github.com/crowdin/github-action/network/dependents?package_id=UGFja2FnZS0yOTQyNTU3MzA0)
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
- Run any [Crowdin CLI](https://crowdin.github.io/crowdin-cli/commands/crowdin) command.

## Usage

Set up a workflow in *.github/workflows/crowdin.yml* (or add a job to your existing workflows).

Read the [Configuring a workflow](https://help.github.com/en/articles/configuring-a-workflow) article for more details on creating and setting up GitHub workflows.

### Sample workflow

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
        uses: crowdin/github-action@v2
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
          # A classic GitHub Personal Access Token with the 'repo' scope selected (the user should have write access to the repository).
          GITHUB_TOKEN: ${{ secrets.GH_TOKEN }}
          
          # A numeric ID, found at https://crowdin.com/project/<projectName>/tools/api
          CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}

          # Visit https://crowdin.com/settings#api-key to create this token
          CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
```

Create the `CROWDIN_PROJECT_ID` and `CROWDIN_PERSONAL_TOKEN` secrets in Repository settings -> Secrets and variables -> Actions > Repository secrets.

> [!TIP]
> When creating a personal token in Crowdin, you'll be asked to select the necessary scopes. The basic Crowdin Personal Token scopes are the following:
>
> - **Projects** (List, Get, Create, Edit) -> Read
> - **Translation Status** -> Read Only
> - **Source files & strings** -> Read and Write
> - **Translations** -> Read and Write
>
> Please note that these scopes may vary depending on the actions you want to perform.

> [!NOTE]
> For fully automated AI localization with Crowdin, check out the [AI Localization](/docs/AI.md) guide.

### Sample `crowdin.yml` configuration file

```yaml
"project_id_env": "CROWDIN_PROJECT_ID"
"api_token_env": "CROWDIN_PERSONAL_TOKEN"
"base_path": "."

"preserve_hierarchy": true

"files": [
  {
    "source": "locales/en.yml",
    "translation": "locales/%two_letters_code%.yml"
  }
]
```

Replace the `source` and `translation` paths with the actual paths to your source and translation files.

By default, the action will look for the `crowdin.yml` file in the root of the repository. You can specify a different path using the `config` option.

> [!CAUTION]
> Make sure you use environment variables and do not hardcode your Crowdin API token in the configuration file.

## Supported options

### Upload options

| Option                     | Description                                                                                        | Example value                |
|----------------------------|----------------------------------------------------------------------------------------------------|------------------------------|
| `upload_sources`           | Specifies whether or not to upload sources to Crowdin                                              | `true` (default)             |
| `upload_translations`      | Specifies whether or not to upload existing translations to Crowdin                                | `false` (default)            |
| `upload_language`          | Upload translations for a single specified language                                                | `uk`                         |
| `auto_approve_imported`    | Automatically approve added translations                                                           | `false` (default)            |
| `import_eq_suggestions`    | Add translations even if they match the source strings                                             | `false` (default)            |
| `upload_sources_args`      | Allows passing any supported arguments of the [`upload sources`][upload-sources] command           | `--no-auto-update label=web` |
| `upload_translations_args` | Allows passing any supported arguments of the [`upload translations`][upload-translations] command | `--translate-hidden`         |

### Download options

| Option                       | Description                                                                                            | Example value                       |
|------------------------------|--------------------------------------------------------------------------------------------------------|-------------------------------------|
| `download_sources`           | Specifies whether to download sources from Crowdin                                                     | `false` (default)                   |
| `download_translations`      | Specifies whether to download translations from Crowdin                                                | `false` (default)                   |
| `download_bundle`            | The numeric ID of the Bundle you want to download translations from                                    | `1`                                 |
| `download_language`          | Download translations for a single specified language                                                  | `uk`                                |
| `skip_untranslated_strings`  | Skip untranslated strings when downloading translations                                                | `false` (default)                   |
| `skip_untranslated_files`    | Skip untranslated files when downloading translations                                                  | `false` (default)                   |
| `export_only_approved`       | Include only approved translations in exported files                                                   | `false` (default)                   |
| `download_sources_args`      | Allows passing any supported arguments of the [`download sources`][download-sources] command           | `--reviewed`                        |
| `download_translations_args` | Allows passing any supported arguments of the [`download translations`][download-translations] command | `--all --skip-untranslated-strings` |

### Git and Pull Request options

| Option                          | Description                                                                                                  | Example value                                         |
|---------------------------------|--------------------------------------------------------------------------------------------------------------|-------------------------------------------------------|
| `push_translations`             | Push downloaded translations to the localization branch                                                      | `true` (default)                                      |
| `push_sources`                  | Push downloaded sources to the localization branch                                                           | `true` (default)                                      |
| `localization_branch_name`      | The name of the git branch that Crowdin will create when pushing translations or sources                     | `l10n_crowdin_action` (default)                       |
| `commit_message`                | The commit message for the pushed changes                                                                    | `New Crowdin translations by GitHub Action` (default) |
| `create_pull_request`           | Specifies whether to create a pull request with the translations                                             | `true` (default)                                      |
| `pull_request_title`            | The pull request title                                                                                       | `New Crowdin translations by GitHub Action` (default) |
| `pull_request_body`             | The pull request body                                                                                        | `New Crowdin pull request with translations`          |
| `pull_request_labels`           | The pull request labels                                                                                      | `localization, l10n`                                  |
| `pull_request_assignees`        | The pull request assignees                                                                                   | `crowdin-bot`                                         |
| `pull_request_reviewers`        | The pull request reviewers                                                                                   | `user-reviewer`                                       |
| `pull_request_team_reviewers`   | The pull request team reviewers                                                                              | `team-reviewer`                                       |
| `pull_request_base_branch_name` | The git branch name to with pull request will be created. If not specified, the default branch is used       | `main`                                                |
| `skip_ref_checkout`             | Skip the default git checkout on `GITHUB_REF` if you need to checkout multiple branches in a single workflow | `false` (default)                                     |

### Global options

| Option                 | Description                                                                                | Example value              |
|------------------------|--------------------------------------------------------------------------------------------|----------------------------|
| `crowdin_branch_name`  | Option to upload or download files to the specified version branch in your Crowdin project | `l10n_branch`              |
| `config`               | Option to specify a path to the configuration file (without `/` at the beginning)          | `path/to/your/crowdin.yml` |
| `dryrun_action`        | Defines whether to run the action in the dry-run mode                                      | `false` (default)          |

### GitHub (Enterprise) configuration

| Option                | Description                                                                                                                | Example value                       |
|-----------------------|----------------------------------------------------------------------------------------------------------------------------|-------------------------------------|
| `github_base_url`     | Option to configure the base URL of GitHub server, if using GitHub Enterprise                                              | `github.com` (default)              |
| `github_api_base_url` | Options to configure the base URL of GitHub server for API requests, if using GHE and different from `api.github_base_url` | `api.[github_base_url]`             |
| `github_user_name`    | Option to configure GitHub user name on commits                                                                            | `Crowdin Bot` (default)             |
| `github_user_email`   | Option to configure GitHub user email on commits                                                                           | `support+bot@crowdin.com` (default) |
| `gpg_private_key`     | GPG private key in ASCII-armored format                                                                                    | `${{ secrets.GPG_PRIVATE_KEY }}`    |
| `gpg_passphrase`      | The passphrase for the ASCII-armored key                                                                                   | `${{ secrets.GPG_PASSPHRASE }}`     |

> [!NOTE]
> For signed commits, add your ASCII-armored key and export `gpg --armor --export-secret-key GPG_KEY_ID`
>
> Ensure that all emails are the same: for account profile that holds private key, the one specified during key generation, and for commit author (`github_user_email` parameter)

### CLI config options

| Option          | Description                                                              | Example value                            |
|-----------------|--------------------------------------------------------------------------|------------------------------------------|
| `token`         | Crowdin Personal Access Token                                            | `${{ secrets.CROWDIN_PERSONAL_TOKEN }}`  |
| `project_id`    | The numeric project ID (_Tools_ > _API_ section in your Crowdin project) | `${{ secrets.CROWDIN_PROJECT_ID }}`      |
| `source`        | Path to the source files (without `/` at the beginning)                  | `sources/pattern`                        |
| `translation`   | Path to the translation files                                            | `translations/pattern`                   |
| `base_url`      | Base URL of Crowdin server for API requests execution                    | `https://api.crowdin.com`                |
| `base_path`     | The project base path                                                    | `.`                                      |

The options above can be used in the [No-crowdin.yml configuration](/docs/EXAMPLES.md#no-crowdinyml-configuration) mode.

> [!NOTE]
> The `base_url` is required For Crowdin Enterprise and should be passed in the following way: `base_url: 'https://{organization-name}.api.crowdin.com'`

### Crowdin CLI command

You can also run any other Crowdin CLI command by specifying the `command` and `command_args` _(optional)_ options. For example:

```yaml
- name: crowdin action
  uses: crowdin/github-action@v2
  with:
    command: 'pre-translate'
    command_args: '-l uk --method tm --branch main'
```

To see the full list of available commands, visit the [official documentation](https://crowdin.github.io/crowdin-cli/).

## Outputs

This action has the following outputs:

- `pull_request_url`: The URL of the pull request created by the workflow
- `pull_request_number`: The number of the pull request created by the workflow

## Permissions

In order to push translations and create pull requests, the Crowdin GitHub Action requires the `GITHUB_TOKEN` to have the write permission on the `contents` and `pull-requests`.

In case you want to use an [automatic GitHub authentication token](https://docs.github.com/en/actions/security-guides/automatic-token-authentication), you need to assign the [`write` permission to your job](https://docs.github.com/en/actions/using-jobs/assigning-permissions-to-jobs) and [allow GH Actions to create Pull Requests](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#preventing-github-actions-from-creating-or-approving-pull-requests).

## Migration from the native GitHub integration

If you are using the [native GitHub integration](https://store.crowdin.com/github), you can easily migrate to the GitHub Action. The main difference is that the GitHub Action requires a Crowdin Personal Access Token and a numeric project ID to be specified. Follow the steps below to migrate:

- If you're using a `crowdin.yml` file, you'll need to add `preserve_hierarchy: true` to keep the directory structure the same between Crowdin and GitHub (even if you weren't already using this setting in your existing OAuth integration).
- `localization_branch_name` should be set to the existing Git branch name you're using for Crowdin PRs.
- `crowdin_branch_name` should be set as well.

For example, if you have the following configuration file:

```yaml
files:
  - source: /**/*.xml
    translation: /**/%two_letters_code%.xml
```

Add the credentials:

```yaml
project_id_env: CROWDIN_PROJECT_ID
api_token_env: CROWDIN_PERSONAL_TOKEN

files:
  - source: /**/*.xml
    translation: /**/%two_letters_code%.xml
```

Then create the secrets `CROWDIN_PROJECT_ID` and `CROWDIN_PERSONAL_TOKEN` and finally, create the workflow. See [Usage](#usage) for more details.

If comparing the native GitHub integration and the GitHub Action, the GitHub Action provides more flexibility and control over the localization process.

## Contributing

If you would like to contribute, please read the [Contributing](/CONTRIBUTING.md) guidelines.

## Seeking Assistance

If you find any problems or would like to suggest a feature, please feel free to file an issue on GitHub at the [Issues Page](https://github.com/crowdin/github-action/issues). Please also check the [Examples](/docs/EXAMPLES.md) page for more use cases.

## License

<pre>
The Crowdin GitHub Action is licensed under the MIT License.
See the LICENSE file distributed with this work for additional
information regarding copyright ownership.

Except as contained in the LICENSE file, the name(s) of the above copyright
holders shall not be used in advertising or otherwise to promote the sale,
use or other dealings in this Software without prior written authorization.
</pre>

[upload-sources]: https://crowdin.github.io/crowdin-cli/commands/crowdin-upload-sources
[upload-translations]: https://crowdin.github.io/crowdin-cli/commands/crowdin-upload-translations
[download-sources]: https://crowdin.github.io/crowdin-cli/commands/crowdin-download-sources
[download-translations]: https://crowdin.github.io/crowdin-cli/commands/crowdin-download-translations
