# Crowdin Action usage examples

- [Create PR with the new translations](#create-pr-with-the-new-translations)
- [Translations export options configuration](#translations-export-options-configuration)
- [No-crowdin.yml configuration](#no-crowdinyml-configuration)
- [Upload sources only](#upload-sources-only)
- [Upload sources to the branch in Crowdin](#upload-sources-to-the-branch-in-crowdin)
- [Download only translations without pushing to a branch](#download-only-translations-without-pushing-to-a-branch)
- [Advanced Pull Request configuration](#advanced-pull-request-configuration)
- [Custom `crowdin.yml` file location](#custom-crowdinyml-file-location)
- [Separate PRs for each target language](#separate-prs-for-each-target-language)
- [Triggers](#triggers)
  - [Cron schedule](#cron-schedule)
  - [Manually](#manually)
  - [When a localization file is updated in the specified branch](#when-a-localization-file-is-updated-in-the-specified-branch)
  - [When a new GitHub Release is published](#when-a-new-github-release-is-published)
  - [Dealing with concurrency](#dealing-with-concurrency)
  - [Handling parallel runs](#handling-parallel-runs)

---

### Create PR with the new translations

```yaml
name: Crowdin Action

on:
  push:
    branches: [ main ]

jobs:
  crowdin:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout
      uses: actions/checkout@v3

    - name: Synchronize with Crowdin
      uses: crowdin/github-action@1
      with:
        upload_sources: true
        upload_translations: true
        download_translations: true
        localization_branch_name: l10n_crowdin_translations

        create_pull_request: true
        pull_request_title: 'New Crowdin translations'
        pull_request_body: 'New Crowdin pull request with translations'
        pull_request_base_branch_name: 'main'
      env:
        GITHUB_TOKEN: ${{ secrets.GH_TOKEN }}
        CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
        CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
```

### Translations export options configuration

```yaml
name: Crowdin Action

on:
  push:
    branches: [ main ]

jobs:
  crowdin:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Synchronize with Crowdin
        uses: crowdin/github-action@1
        with:
          upload_sources: true
          upload_translations: false
          download_translations: true

          # Export options
          skip_untranslated_strings: true
          export_only_approved: true
        env:
        GITHUB_TOKEN: ${{ secrets.GH_TOKEN }}
        CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
        CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
```

### No-crowdin.yml configuration

```yaml
name: Crowdin Action

on:
  push:
    branches: [ main ]

jobs:
  crowdin:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Crowdin sync
        uses: crowdin/github-action@1
        with:
          upload_sources: true
          upload_translations: false

          # Sources pattern
          source: src/locale/en.json
          # Translations pattern
          translation: src/locale/%android_code%.json

          project_id: ${{ secrets.CROWDIN_PROJECT_ID }}
          token: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Upload sources only

```yaml
name: Crowdin Action

on:
  push:
    branches: [ main ]

jobs:
  crowdin:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout
      uses: actions/checkout@v3

    - name: Crowdin push
      uses: crowdin/github-action@1
      with:
        upload_sources: true
        upload_translations: false
        download_translations: false
      env:
        CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
        CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
```

### Upload sources to the branch in Crowdin

```yaml
name: Crowdin Action

on:
  push:
    branches: [ main ]

jobs:
  crowdin:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout
      uses: actions/checkout@v3

    - name: Crowdin push
      uses: crowdin/github-action@1
      with:
        upload_sources: true
        upload_translations: false
        download_translations: false
        crowdin_branch_name: "${{ env.BRANCH_NAME }}"
      env:
        CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
        CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
```

### Download only translations without pushing to a branch

It's possible only to download the translations without immediate PR creation.
It allows you to post-process the downloaded translations and create a PR later.

```yaml
name: Crowdin Action

on:
  push:
    branches: [ main ]

jobs:
  crowdin:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout
      uses: actions/checkout@v3

    - name: Crowdin pull
      uses: crowdin/github-action@1
      with:
        upload_sources: false
        upload_translations: false
        download_translations: true
        create_pull_request: false
        push_translations: false
      env:
        CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
        CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
```

### Advanced Pull Request configuration

There is a possibility to specify labels, assignees, reviewers for PR created by the Action.

```yaml
name: Crowdin Action

on:
  push:
    branches: [ main ]

jobs:
  crowdin:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout
      uses: actions/checkout@v3

    - name: Synchronize with Crowdin
      uses: crowdin/github-action@1
      with:
        upload_sources: true
        upload_translations: true
        download_translations: true
        localization_branch_name: l10n_crowdin_translations

        create_pull_request: true
        pull_request_title: 'New Crowdin translations'
        pull_request_body: 'New Crowdin pull request with translations'
        pull_request_base_branch_name: 'main'
  
        pull_request_labels: 'enhancement, good first issue'
        pull_request_assignees: 'crowdin-bot'
        pull_request_reviewers: 'crowdin-reviewer'
      env:
        GITHUB_TOKEN: ${{ secrets.GH_TOKEN }}
        CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
        CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
```

### Custom `crowdin.yml` file location

```yaml
...

- name: Crowdin
  uses: crowdin/github-action@1
  with:
    config: '.github/crowdin.yml'

  ...
```

### Separate PRs for each target language

```yaml
name: Crowdin Action

on:
  push:
    branches: [ main ]

jobs:
  crowdin:
    name: Synchronize with Crowdin
    runs-on: ubuntu-latest

    strategy:
      fail-fast: false
      max-parallel: 1 # Should be 1 to avoid parallel builds
      matrix:
        lc: [uk, it, es, fr, de, pt-BR] # Target languages https://developer.crowdin.com/language-codes/
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Matrix
        uses: crowdin/github-action@1
        with:
          upload_sources: false
          upload_translations: false
          download_translations: true
          commit_message: New Crowdin translations - ${{ matrix.lc }}
          localization_branch_name: l10n_main_${{ matrix.lc }}
          pull_request_base_branch_name: 'main'
          pull_request_title: New translations - ${{ matrix.lc }}
          download_language: ${{ matrix.lc }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
          CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}

```

## Triggers

### Cron schedule

```yaml
on:
  schedule:
    - cron: '0 */12 * * *' # Every 12 hours - https://crontab.guru/#0_*/12_*_*_*
```

### Manually

```yaml
on:
  workflow_dispatch:
```

### When a localization file is updated in the specified branch

```yaml
on:
  push:
    paths:
      - 'src/locales/en.json'
    branches: [ main ]
```

### When a new GitHub Release is published

```yaml
on:
  release:
    types: [published]
```

### Dealing with concurrency

```yaml
on:
  push:
    branches:
      - main
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
```

### Handling parallel runs

In case your action fails when a build is in progress (409 error code), you need to configure the workflow in a way to avoid parallel runs.

```yaml
strategy:
  max-parallel: 1
```

[Read more](https://github.com/crowdin/github-action/wiki/Handling-parallel-runs)
