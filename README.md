[<p align='center'><img src='https://support.crowdin.com/assets/logos/crowdin-dark-symbol.png' data-canonical-src='https://support.crowdin.com/assets/logos/crowdin-dark-symbol.png' width='200' height='200' align='center'/></p>](https://crowdin.com)

# Github Crowdin Action

## What does this action do?
- Uploads sources to Crowdin.
- Uploads translations to Crowdin.
- Downloads translations from Crowdin.


## Usage
Set up a workflow in .github/workflows/crowdin.yml (or add a job to your existing workflows).

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
      uses: crowdin/github-action@master
      with:
        upload_translations: true
        download_translations: true
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
        CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
```

## Supported options
The default action is to upload sources. Though, you can set different actions through the “with” options. If you don't want to upload your sources to Crowdin, just set the upload_sources option to false.

By default sources and translations are being uploaded to the root of your Crowdin project. Still, if you use branches, you can set the preferred source branch.

You can also specify what GitHub branch you’d like to download your translations to (default translation branch is l10n_crowdin_action).

In case you don’t want to download translations from Crowdin (download_translations: false), localization_branch_name and create_pull_request options aren't required either.

```yaml
- name: crowdin action
  with:
    upload_sources: true
    upload_translations: true
    crowdin_branch_name: l10n_branch
    dryrun_action: true

    download_translations: true
    localization_branch_name: l10n_crowdin_action
    create_pull_request: true
```
