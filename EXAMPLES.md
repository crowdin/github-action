# Crowdin Action usage examples

- [Create PR with the new translations](#create-pr-with-the-new-translations)
- [Translations export options configuration](#translations-export-options-configuration)
- [No-crowdin.yml configuration](#no-crowdinyml-configuration)
- [Upload sources only](#upload-sources-only)
- [Upload sources to the branch in Crowdin](#upload-sources-to-the-branch-in-crowdin)
- [Download only translations without pushing to a branch](#download-only-translations-without-pushing-to-a-branch)
- [Download Bundle](#download-bundle)
- [Advanced Pull Request configuration](#advanced-pull-request-configuration)
- [Custom `crowdin.yml` file location](#custom-crowdinyml-file-location)
- [Separate PRs for each target language](#separate-prs-for-each-target-language)
- [Checking out multiple branches in a single workflow](#checking-out-multiple-branches-in-a-single-workflow)
- [Outputs](#outputs)
  - [`pull_request_url`](#pull_request_url)
- [Triggers](#triggers)
  - [Cron schedule](#cron-schedule)
  - [Manually](#manually)
  - [When a localization file is updated in the specified branch](#when-a-localization-file-is-updated-in-the-specified-branch)
  - [When a new GitHub Release is published](#when-a-new-github-release-is-published)
  - [Dealing with concurrency](#dealing-with-concurrency)
  - [Handling parallel runs](#handling-parallel-runs)
- [Tips and tricks](#tips-and-tricks)
  - [Checking the translation progress](#checking-the-translation-progress)
  - [Pre-Translation](#pre-translation)

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
        uses: actions/checkout@v4

      - name: Synchronize with Crowdin
        uses: crowdin/github-action@v1
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
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
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
        uses: actions/checkout@v4

      - name: Synchronize with Crowdin
        uses: crowdin/github-action@v1
        with:
          upload_sources: true
          upload_translations: false
          download_translations: true

          # Export options
          skip_untranslated_strings: true
          export_only_approved: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
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
        uses: actions/checkout@v4

      - name: Crowdin sync
        uses: crowdin/github-action@v1
        with:
          upload_sources: true
          upload_translations: false
          source: src/locale/en.json                     # Sources pattern
          translation: src/locale/%android_code%.json    # Translations pattern
          project_id: ${{ secrets.CROWDIN_PROJECT_ID }}  # Crowdin Project ID
          token: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}   # Crowdin Personal Access Token
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> **Note**
> To avoid any conflicts, do not use the `crowdin.yml` file in the repository when using the above configuration approach.

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
        uses: actions/checkout@v4

      - name: Crowdin push
        uses: crowdin/github-action@v1
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
        uses: actions/checkout@v4

      - name: Crowdin push
        uses: crowdin/github-action@v1
        with:
          upload_sources: true
          upload_translations: false
          download_translations: false
          crowdin_branch_name: ${{ env.BRANCH_NAME }}
        env:
          CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
          CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
```

Note that the value of the `crowdin_branch_name` is `env.BRANCH_NAME` - this is the name of the current branch on which the action is running.

### Download only translations without pushing to a branch

It's possible to just download the translations without creating a PR immediately. It allows you to post-process the downloaded translations and create a PR later.

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
        uses: actions/checkout@v4

      - name: Crowdin pull
        uses: crowdin/github-action@v1
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

You can use the [Create Pull Request](https://github.com/marketplace/actions/create-pull-request) GitHub Action to create a PR with the downloaded translations.

### Download Bundle

Target file bundles or simply Bundles is the feature that allows you to export sets of strings or files in the formats you select, regardless of the original file format

You can use the `download_bundle` option to download the bundle from Crowdin:

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
        uses: actions/checkout@v4

      - name: Crowdin pull
        uses: crowdin/github-action@v1
        with:
          download_translations: false
          download_bundle: 1
          create_pull_request: true
        env:
          CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
          CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
```

> **Note**
> If you are using a **String-based** project, you need to use this option to download translations. The default `download_translations` option does not work for this type of projects.

The `download_bundle` option accepts the bundle numeric ID.

Visit the [official documentation](https://support.crowdin.com/bundles/) to learn more about Bundles.

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
        uses: actions/checkout@v4

      - name: Synchronize with Crowdin
        uses: crowdin/github-action@v1
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
          pull_request_reviewers: 'crowdin-user-reviewer'
          pull_request_team_reviewers: 'crowdin-team-reviewer'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
          CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
```

### Custom `crowdin.yml` file location

By default, the Action looks for the `crowdin.yml` file in the repository root. You can specify a custom location of the configuration file:

```yaml
# ...

- name: Crowdin
  uses: crowdin/github-action@v1
  with:
    config: '.github/crowdin.yml'
    #...
```

### Separate PRs for each target language

You can use the [`matrix`](https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs) feature of GitHub Actions to create separate PRs for each target language:

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
        uses: actions/checkout@v4

      - name: Matrix
        uses: crowdin/github-action@v1
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

### Checking out multiple branches in a single workflow

If you need to checkout multiple branches in a single workflow (e.g. a matrix of feature branches), you'll need to disable the automatic checkout to the `GITHUB_REF` by using the `skip_ref_checkout` option:

```yml
name: Crowdin Action

on:
  workflow_dispatch:

jobs:
  crowdin:
    name: Synchronize with Crowdin
    runs-on: ubuntu-latest

    strategy:
      fail-fast: false
      max-parallel: 1 # Should be 1 to avoid parallel builds
      matrix:
        branch: ["feat/1", "feat/2", "feat/3"]

    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ matrix.branch }}
          fetch-depth: 0

      - name: Synchronize with Crowdin
        uses: crowdin/github-action@v1
        with:
          upload_sources: true
          upload_translations: true
          download_translations: true
          localization_branch_name: l10n_crowdin_translations
          create_pull_request: true
          skip_ref_checkout: true # Disable 'git checkout "${GITHUB_REF#refs/heads/}"'
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

## Outputs

### `pull_request_url`

There is a possibility to get the URL of the created Pull Request. You can use it in the next steps of your workflow.

```yaml
# ...
- name: Crowdin
  uses: crowdin/github-action@v1
  id: crowdin-download
  with:
    download_translations: true
    create_pull_request: true
    env:
      CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
      CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}

- name: Enable auto-merge for the PR
  if: steps.crowdin-download.outputs.pull_request_url
  run: gh pr --repo $GITHUB_REPOSITORY merge ${{ steps.crowdin-download.outputs.pull_request_url }} --auto --merge
  env:
    GITHUB_TOKEN: ${{secrets.GITHUB_TOKEN}}

- name: Approve the PR
  if: steps.crowdin-download.outputs.pull_request_url
  run: gh pr --repo $GITHUB_REPOSITORY review ${{ steps.crowdin-download.outputs.pull_request_url }} --approve
  env:
    GITHUB_TOKEN: ${{secrets.GITHUB_TOKEN}}
```

## Tips and Tricks

### Checking the translation progress

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
        uses: actions/checkout@v4

      - name: Check translation progress
        uses: crowdin/github-action@v1
        with:
          command: 'status translation'
          command_args: '--fail-if-incomplete'
```

In the example above, the workflow will fail if the translation progress is less than 100%.

Visit the [official documentation](https://crowdin.github.io/crowdin-cli/commands/crowdin-status) to learn more about the available translation status options.

### Pre-Translation

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
        uses: actions/checkout@v4

      - name: Pre-translate
        uses: crowdin/github-action@v1
        with:
          command: 'pre-translate'
          command_args: '--language uk --method tm'
        env:
          CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
          CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
```

Visit the [official documentation](https://crowdin.github.io/crowdin-cli/commands/crowdin-pre-translate) to learn more about the available pre-translation options.
