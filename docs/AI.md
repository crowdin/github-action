# AI Localization

Crowdin offers a set of tools to help you localize your project with AI. These tools are designed to help you save time and effort on localization tasks, making the process more efficient and cost-effective.

While Crowdin GitHub Action is a powerful tool for automating localization workflows, you will need to make sure that you provide the necessary context for the AI to work effectively. This means that you will need to provide the AI with the necessary information about your project, such as the source files.

## Preparing Your Project

Crowdin integrates with top AI providers, including OpenAI, Google Gemini, Microsoft Azure OpenAI, DeepSeek, xAI, and more, allowing you to leverage advanced AI-powered translations that consider additional context at different levels.

To get started, you will need to add the AI Provider and Prompt to your Crowdin profile or organization settings.

> [!TIP]
> Visit the [Crowdin AI](https://support.crowdin.com/crowdin-ai/) page to learn more about the AI providers and how to set up AI in your Crowdin account.

After setting up the AI provider and Prompt, store their IDs in the Actions secrets: create the `PROVIDER_ID`, `PROMPT_ID` secrets in _Repository settings_ -> _Secrets and variables_ -> _Actions_ > _Repository secrets_. Also, create a new GitHub Actions secret to store the Personal Access Token and the Crowdin Project ID: `CROWDIN_PERSONAL_TOKEN`, `CROWDIN_PROJECT_ID`. Read more about [Personal Access Tokens](https://support.crowdin.com/account-settings/#personal-access-tokens/).

As a result, you must have the following secrets configured for your repository:

- `PROVIDER_ID` - AI Provider ID
- `PROMPT_ID` - Prompt ID
- `CROWDIN_PERSONAL_TOKEN` - Crowdin Personal Access Token
- `CROWDIN_PROJECT_ID` - Crowdin Project ID

## Automatic AI Pre-Translation

The basic workflow for AI localization includes the following steps:

- Source files are uploaded to Crowdin.
- Automatic pre-translation is performed using the AI provider.
- Translations are downloaded.
- Push the translations to the repository and create a pull request.

Here is an example of how to set up the automatic AI pre-translation workflow using the Crowdin GitHub Action:

```yaml
name: Crowdin Pre-translate with AI

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  crowdin-process:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Upload Sources to Crowdin
        uses: crowdin/github-action@v2
        with:
          upload_sources: true
          upload_translations: false
          download_translations: false
          create_pull_request: false
          push_translations: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
          CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}

      - name: Pre-translate with AI
        uses: crowdin/github-action@v2
        with:
          command: 'pre-translate'
          command_args: '--method ai --ai-prompt=${{ secrets.PROMPT_ID }}'
        env:
          CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
          CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}

      - name: Download Translations from Crowdin
        uses: crowdin/github-action@v2
        with:
          upload_sources: false
          upload_translations: false
          download_translations: true
          localization_branch_name: l10n_crowdin_ai_translations
          create_pull_request: true
          pull_request_title: 'New Crowdin AI Translations'
          pull_request_body: 'New translations generated with Crowdin AI pre-translation'
          pull_request_base_branch_name: 'main'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
          CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
```

> [!TIP]
> For more control over your workflow, see additional [Triggers](EXAMPLES.md#triggers) examples including cron schedules, manual triggers, and file-based triggers.

## Providing Context for AI

Context is crucial for accurate and high-quality translations. With the enhanced context, AI produces production-quality translations that were previously only possible with human input.

> [!IMPORTANT]
> Experiments have shown that LLM + AI Extracted Context can improve the translation quality by up to 75% and LLM + AI Extracted Context + Screenshots + Crowdin AI Tools can improve the translation quality by up to 95%.

### Harvesting Context with Crowdin Context Harvester CLI

To ensure that AI translations are accurate and contextually relevant, you need to provide the AI with the necessary context.

Crowdin allows you to provide various levels of context to the AI, including the options available during prompt configuration (glossary terms, TM suggestions, previous and next strings, file context, screenshots, and more). It's highly recommended that you provide the AI with as much context as possible to improve the quality of the translations. 

You can use the [Crowdin Context Harvester CLI](https://store.crowdin.com/crowdin-context-harvester-cli) in your CI/CD pipeline to automate the context extraction process. The Context Harvester CLI is designed to simplify the process of extracting context for Crowdin strings from your code. Using Large Language Models (LLMs), it automatically analyzes your project code to find out how each key is used. This information is extremely useful for the human linguists or AI that will be translating your project keys, and is likely to improve the quality of the translation.

First, install the Crowdin Context Harvester CLI and configure it with your Crowdin project:

```bash
npm i -g crowdin-context-harvester
crowdin-context-harvester configure
```

You'll be asked to enter all the necessary information, such as your Crowdin Personal Access Token, Project ID, and other details.

For example:

```bash
crowdin-context-harvester configure
? What Crowdin product do you use? Crowdin.com
? Crowdin Personal API token (with Project, AI scopes): __your_personal_token_
? Crowdin project: Test Project
? AI provider: Crowdin AI Provider
? Crowdin AI provider (you should have the OpenAI provider configured in Crowdin): Open AI
? AI model (newest models with largest context window are preferred): gpt-4
? Model context window size in tokens: 128000
? Model maximum output tokens count: 16384
? Check if the code contains the key or the text of the string before sending it to the AI model 
(recommended if you have thousands of keys to avoid chunking and improve speed).: I use keys in the code
? Custom prompt file. "-" to read from STDIN (optional): 
? Local files (glob pattern): **/*.*
? Ignore local files (glob pattern). Make sure to exclude unnecessary files to avoid unnecessary AI API calls: /**/node_modules/**
? Crowdin files (glob pattern e.g. **/*.*).: **/*.*
? CroQL query (optional): 
? Output: Terminal (dry run)

You can now execute the harvest command by running:

crowdin-context-harvester harvest --token="__your_personal_token_" --project=11111 --ai="crowdin" --crowdinAiId=2222 --model="gpt-4" --localFiles="**/*.*" --localIgnore="/**/node_modules/**" --crowdinFiles="**/*.*" --contextWindowSize="128000" --maxOutputTokens="16384" --screen="keys" --output="terminal"
```

Once you have configured the Crowdin Context Harvester CLI, you can use the received `harvest` command to extract the context from your project files and provide it to the AI for better translations in your CI/CD pipeline.

Then, add the following steps to your GitHub Actions workflow to extract the context and provide it to the AI:

```yaml
# Upload sources step

- uses: actions/setup-node@v4
  with:
    node-version: '22'

- name: Extract Context for AI
  run: |
    npm i -g crowdin-context-harvester
    crowdin-context-harvester harvest \
      --ai="crowdin" \
      --crowdinAiId="${{ secrets.PROVIDER_ID }}" \
      --model="gpt-4" \
      --localFiles="**/*.*" \
      --localIgnore="/**/node_modules/**" \
      --crowdinFiles="**/*.*" \
      --contextWindowSize="128000" \
      --maxOutputTokens="16384" \
      --screen="keys" \
      --output="terminal"

- name: Upload Context
  run: |
    crowdin-context-harvester upload \
      --token="${{ secrets.CROWDIN_PERSONAL_TOKEN }}" \
      --project="${{ secrets.CROWDIN_PROJECT_ID }}" \
      --csvFile="crowdin-context.csv"

# Pre-translate with AI step
# Download translations step
```

> [!CAUTION]
> Make sure to omit the personal access token and project ID from the command line and store them in the GitHub Actions secrets. The CLI will automatically use the secrets if they are set.

### Automated Screenshots

Crowdin also allows you to provide screenshots to the AI to help it better understand the context. Depending on the type of project, Crowdin offers a few different ways to automate the screenshot generation process:

- [For Web Projects](https://support.crowdin.com/developer/automating-screenshot-management/)
- [For Android Projects](https://crowdin.github.io/mobile-sdk-android/guides/screenshots-automation)
- [For iOS Projects](https://crowdin.github.io/mobile-sdk-ios/guides/screenshots-automation)

Integrate automated screenshot generation into your CI/CD pipeline to give AI the context it needs for better translations.

## See more

- [Crowdin AI](https://support.crowdin.com/crowdin-ai/)
- [Usage of AI localization with Crowdin branches](https://github.com/crowdin/github-action/discussions/280)
