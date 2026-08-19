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
      - uses: actions/checkout@v7

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

### Extracting Context with AI Agents

To ensure that AI translations are accurate and contextually relevant, you need to provide the AI with the necessary context.

Crowdin allows you to provide various levels of context to the AI, including the options available during prompt configuration (glossary terms, TM suggestions, previous and next strings, file context, screenshots, and more). It's highly recommended that you provide the AI with as much context as possible to improve the quality of the translations. 

The recommended way to extract context from your codebase is to use the [Crowdin CLI context commands](https://crowdin.github.io/crowdin-cli/commands/crowdin-context) together with an AI coding agent (Claude Code, Cursor, GitHub Copilot, etc.). The agent analyzes your codebase to find out how each string is used and stores this information in Crowdin. It is extremely useful for the human linguists or AI that will be translating your project strings and is likely to improve the quality of the translation.

The workflow consists of three steps:

1. **Download** the strings that are missing context to a local `crowdin-context.jsonl` file:

   ```bash
   crowdin context download --status empty
   ```

2. **Enrich** — the AI agent fills in the `ai_context` field for each string based on your codebase.

3. **Upload** the enriched context back to Crowdin:

   ```bash
   crowdin context upload
   ```

To teach your AI agent this workflow, install the [Crowdin Agent Skills](https://github.com/crowdin/skills). They include the `crowdin-context-cli` skill (context commands and JSONL format) and the `context-extraction` skill (rules for writing meaningful context):

```bash
npx skills add crowdin/skills
```

Once the skills are installed, a single prompt is enough for the agent to handle all the steps autonomously:

```
Use the Crowdin CLI to download strings that are missing context, enrich them
with precise UI placement descriptions based on our codebase, and upload the
enriched context back to Crowdin.
```

At any point, you can check the context coverage of your project by running `crowdin context status`.

The context commands can also be executed as part of your GitHub Actions workflow using the `command` input:

```yaml
- name: Download strings missing context
  uses: crowdin/github-action@v2
  with:
    command: 'context download'
    command_args: '--status empty'
  env:
    CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
    CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}

# Enrich the `crowdin-context.jsonl` file with an AI agent
# (e.g., Claude Code GitHub Action)

- name: Upload strings context
  uses: crowdin/github-action@v2
  with:
    command: 'context upload'
  env:
    CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
    CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
```

> [!TIP]
> Read the [Automating i18n Context with AI Agents](https://crowdin.com/blog/automate-i18n-context-with-ai-agents) blog post to learn more about this workflow.

### Automated Screenshots

Crowdin also allows you to provide screenshots to the AI to help it better understand the context. Depending on the type of project, Crowdin offers a few different ways to automate the screenshot generation process:

- [For Web Projects](https://support.crowdin.com/developer/automating-screenshot-management/)
- [For Android Projects](https://crowdin.github.io/mobile-sdk-android/guides/screenshots-automation)
- [For iOS Projects](https://crowdin.github.io/mobile-sdk-ios/guides/screenshots-automation)

Integrate automated screenshot generation into your CI/CD pipeline to give AI the context it needs for better translations.

## See more

- [Crowdin AI](https://support.crowdin.com/crowdin-ai/)
- [Usage of AI localization with Crowdin branches](https://github.com/crowdin/github-action/discussions/280)
