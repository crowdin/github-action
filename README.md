[<p align='center'><img src='https://support.crowdin.com/assets/logos/crowdin-dark-symbol.png' data-canonical-src='https://support.crowdin.com/assets/logos/crowdin-dark-symbol.png' width='200' height='200' align='center'/></p>](https://crowdin.com)

# Github Crowdin Action

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
      uses: crowdin/github-action@1.0.3
      with:
        upload_translations: true
        download_translations: true
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
        CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
```

## Supported options
The default action is to upload sources. Though, you can set different actions through the “with” options. If you don't want to upload your sources to Crowdin, just set the `upload_sources` option to false.

By default sources and translations are being uploaded to the root of your Crowdin project. Still, if you use branches, you can set the preferred source branch.

You can also specify what GitHub branch you’d like to download your translations to (default translation branch is `l10n_crowdin_action`).

In case you don’t want to download translations from Crowdin (`download_translations: false`), `localization_branch_name` and `create_pull_request` options aren't required either.

```yaml
- name: crowdin action
  with:
    # upload options
    upload_sources: true
    upload_translations: true

    # download options
    download_translations: true
    language: 'uk'
    localization_branch_name: l10n_crowdin_action
    create_pull_request: true

    # global options
    crowdin_branch_name: l10n_branch
    identity: '/path/to/your/credentials/file'
    config: '/path/to/your/crowdin.yml'
    dryrun_action: true

    # config options
    project_id: ${{ secrets.CROWDIN_PROJECT_ID }}
    token: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
    source: '/path/to/your/file'
    translation: 'file/export/pattern'
    base_url: 'https://crowdin.com'
    base_path: '/project-base-path'
```

If your workflow file specifies the `config` property, you'll need to add the following to your [Crowdin configuration file](https://support.crowdin.com/configuration-file/) (e.g. `crowdin.yml`):

```yml
project_id_env: CROWDIN_PROJECT_ID
api_token_env: CROWDIN_PERSONAL_TOKEN
```

When the workflow runs, the real values of your token and project ID will be injected into the config using the secrets in the enviroment.

## Contributing

We are happy to accept contributions to the Crowdin GitHub Action. To contribute please do the following:

- Fork the repository on GitHub.
- Decide which code you want to submit. Commit your changes and push to the new branch.
- Ensure that your code adheres to standard conventions, as used in the rest of the library.
- Submit a pull request with your patch on Github.

This project and everyone participating in it are governed by the [Code of Conduct](/CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

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
