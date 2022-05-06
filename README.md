[<p align='center'><img src='https://support.crowdin.com/assets/logos/crowdin-dark-symbol.png' data-canonical-src='https://support.crowdin.com/assets/logos/crowdin-dark-symbol.png' width='200' height='200' align='center'/></p>](https://crowdin.com)

# Github Crowdin Action [![Tweet](https://img.shields.io/twitter/url/http/shields.io.svg?style=social)](https://twitter.com/intent/tweet?url=https%3A%2F%2Fgithub.com%2Fcrowdin%2Fgithub-action&text=Easily%20integrate%20the%20localization%20of%20your%20Crowdin%20project%20into%20the%20GitHub%20Actions%20workflow)

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/crowdin/github-action?cacheSeconds=5000&logo=github)](https://github.com/crowdin/github-action/releases/latest)
[![GitHub Release Date](https://img.shields.io/github/release-date/crowdin/github-action?cacheSeconds=5000)](https://github.com/crowdin/github-action/releases/latest)
[![GitHub contributors](https://img.shields.io/github/contributors/crowdin/github-action?cacheSeconds=5000)](https://github.com/crowdin/github-action/graphs/contributors)
[![GitHub](https://img.shields.io/github/license/crowdin/github-action?cacheSeconds=50000)](https://github.com/crowdin/github-action/blob/master/LICENSE)

## What does this action do?
- Uploads sources to Crowdin.
- Uploads translations to Crowdin.
- Downloads translations from Crowdin.

## Usage
Set up a workflow in *.github/workflows/crowdin.yml* (or add a job to your existing workflows).

Read the [Configuring a workflow](https://help.github.com/en/articles/configuring-a-workflow) article for more details on how to create and set up custom workflows.
```yaml
name: Crowdin Action

on:
  push:
    branches: [ master ]

jobs:
  synchronize-with-crowdin:
    runs-on: ubuntu-latest

    steps:

    - name: Checkout
      uses: actions/checkout@v2

    - name: crowdin action
      uses: crowdin/github-action@1.4.9
      with:
        upload_translations: true
        download_translations: true
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
        CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
```

:clipboard: To explore the common questions about Crowdin GitHub Action usage visit the [Wiki](https://github.com/crowdin/github-action/wiki).

## Supported options
The default action is to upload sources. Though, you can set different actions through the “with” options. If you don't want to upload your sources to Crowdin, just set the `upload_sources` option to false.

By default sources and translations are being uploaded to the root of your Crowdin project. Still, if you use branches, you can set the preferred source branch.

You can also specify what GitHub branch you’d like to download your translations to (default translation branch is `l10n_crowdin_action`).

In case you don’t want to download translations from Crowdin (`download_translations: false`), `localization_branch_name` and `create_pull_request` options aren't required either.

```yaml
- name: crowdin action
  with:
    # upload sources option
    upload_sources: true
    # this can be used to pass down any supported argument of the `upload sources` cli command, e.g.
    upload_sources_args: '--no-auto-update label=web'

    # upload translations options
    upload_translations: true
    upload_language: 'uk'
    auto_approve_imported: true
    import_eq_suggestions: true
    # this can be used to pass down any supported argument of the `upload translations` cli command, e.g.
    upload_translations_args: '--auto-approve-imported --translate-hidden'

    # download translations options
    download_translations: true
    download_language: 'uk'
    skip_untranslated_strings: true
    skip_untranslated_files: true
    export_only_approved: true
    push_translations: true
    commit_message: 'New Crowdin translations by Github Action'
    # this can be used to pass down any supported argument of the `download translations` cli command, e.g.
    download_translations_args: '--all --skip-untranslated-strings'

    # This is the name of the git branch that Crowdin will create when opening a pull request.
    # This branch does NOT need to be manually created. It will be created automatically by the action.
    localization_branch_name: l10n_crowdin_action
    create_pull_request: true
    pull_request_title: 'New Crowdin translations'
    pull_request_body: 'New Crowdin pull request with translations'
    pull_request_labels: 'enhancement, good first issue'
    # This is the name of the git branch to with pull request will be created.
    # If not specified default repository branch will be used.
    pull_request_base_branch_name: not_default_branch

    # branch options
    add_crowdin_branch: branch_name
    # Title as it appears to translators
    new_branch_title: 'development / main'
    # Defines branch name and path in resulting translations bundle
    new_branch_export_pattern: '/translations/%two_letters_code%/%original_file_name%'
    # [LOW, NORMAL, HIGH]
    new_branch_priority: 'HIGH'
    
    delete_crowdin_branch: branch_name

    # global options

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

    # config options

    # This is a numeric id, not to be confused with Crowdin API v1 "project identifier" string
    # See "API v2" on https://crowdin.com/project/<your-project>/settings#api
    project_id: ${{ secrets.CROWDIN_PROJECT_ID }}

    # A personal access token, not to be confused with Crowdin API v1 "API key"
    # See https://crowdin.com/settings#api-key to generate a token
    token: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
    source: 'path/to/your/file'
    translation: 'file/export/pattern'
    base_url: 'https://crowdin.com'
    base_path: 'project-base-path'
```

**Note:** For Crowdin Enterprise `base_url` is required and should be passed in the following way: `base_url: 'https://{organization-name}.crowdin.com'`

For more detailed descriptions of these options, see [`action.yml`](https://github.com/crowdin/github-action/blob/master/action.yml).

### Crowdin configuration file

If your workflow file specifies the `config` property, you'll need to add the following to your [Crowdin configuration file](https://support.crowdin.com/configuration-file/) (e.g. `crowdin.yml`):

```yml
project_id_env: CROWDIN_PROJECT_ID
api_token_env: CROWDIN_PERSONAL_TOKEN
```

When the workflow runs, the real values of your token and project ID will be injected into the config using the secrets in the environment.

## Contributing

If you want to contribute please read the [Contributing](/CONTRIBUTING.md) guidelines.

## Seeking Assistance
If you find any problems or would like to suggest a feature, please feel free to file an issue on Github at [Issues Page](https://github.com/crowdin/github-action/issues).

Need help working with Crowdin GitHub Action or have any questions?
[Contact Customer Success Service](https://crowdin.com/contacts).

## License
<pre>
The Crowdin GitHub Action is licensed under the MIT License.
See the LICENSE file distributed with this work for additional
information regarding copyright ownership.

Except as contained in the LICENSE file, the name(s) of the above copyright
holders shall not be used in advertising or otherwise to promote the sale,
use or other dealings in this Software without prior written authorization.
</pre>
