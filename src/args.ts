import type { Inputs } from './inputs.js';

/**
 * Splits a string into arguments on whitespace, honouring single and double quotes
 * and backslash escapes (outside single quotes), similar to a POSIX shell but without
 * any expansion.
 */
export function splitArgs(input: string): string[] {
  const args: string[] = [];
  let current = '';
  let inArg = false;
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (quote) {
      if (ch === quote) {
        quote = null;
      } else if (ch === '\\' && quote === '"' && (input[i + 1] === '"' || input[i + 1] === '\\')) {
        current += input[++i];
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      inArg = true;
    } else if (ch === '\\' && i + 1 < input.length && /[\s"'\\]/.test(input[i + 1])) {
      current += input[++i];
      inArg = true;
    } else if (/\s/.test(ch)) {
      if (inArg) {
        args.push(current);
        current = '';
        inArg = false;
      }
    } else {
      current += ch;
      inArg = true;
    }
  }

  if (quote) {
    throw new Error(`Unterminated ${quote} quote in arguments: ${input}`);
  }
  if (inArg) {
    args.push(current);
  }
  return args;
}

/** Splits a comma separated list (e.g. labels, assignees) into trimmed, non-empty items. */
export function splitList(input: string): string[] {
  return input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Global options passed to every Crowdin CLI command, in the same order as the former
 * entrypoint.sh. `withBranch` controls whether `--branch` is appended (it is not passed
 * to `bundle download`).
 */
export function globalArgs(inputs: Inputs, withBranch = true): string[] {
  const args = ['--no-progress', '--no-colors'];

  if (inputs.debugMode) args.push('--verbose', '--debug');
  if (inputs.config) args.push(`--config=${inputs.config}`);
  if (inputs.dryrunAction) args.push('--dryrun');
  if (inputs.projectId) args.push(`--project-id=${inputs.projectId}`);
  if (inputs.token) args.push(`--token=${inputs.token}`);
  if (inputs.baseUrl) args.push(`--base-url=${inputs.baseUrl}`);
  if (inputs.basePath) args.push(`--base-path=${inputs.basePath}`);
  if (inputs.source) args.push(`--source=${inputs.source}`);
  if (inputs.translation) args.push(`--translation=${inputs.translation}`);
  if (inputs.commandArgs) args.push(...splitArgs(inputs.commandArgs));
  if (withBranch && inputs.crowdinBranchName) args.push(`--branch=${inputs.crowdinBranchName}`);

  return args;
}

export function customCommandArgs(inputs: Inputs): string[] {
  return [...splitArgs(inputs.command), ...splitArgs(inputs.commandArgs)];
}

export function uploadSourcesArgs(inputs: Inputs): string[] {
  return ['upload', 'sources', ...globalArgs(inputs), ...splitArgs(inputs.uploadSourcesArgs)];
}

export function uploadTranslationsArgs(inputs: Inputs): string[] {
  const args = ['upload', 'translations', ...globalArgs(inputs)];
  if (inputs.uploadLanguage) args.push(`--language=${inputs.uploadLanguage}`);
  if (inputs.autoApproveImported) args.push('--auto-approve-imported');
  if (inputs.importEqSuggestions) args.push('--import-eq-suggestions');
  args.push(...splitArgs(inputs.uploadTranslationsArgs));
  return args;
}

export function downloadSourcesArgs(inputs: Inputs): string[] {
  return ['download', 'sources', ...globalArgs(inputs), ...splitArgs(inputs.downloadSourcesArgs)];
}

export function downloadTranslationsArgs(inputs: Inputs): string[] {
  const args = ['download', ...globalArgs(inputs)];
  const language = inputs.downloadLanguage || inputs.language;
  if (language) args.push(`--language=${language}`);
  if (inputs.skipUntranslatedStrings) args.push('--skip-untranslated-strings');
  if (inputs.skipUntranslatedFiles) args.push('--skip-untranslated-files');
  if (inputs.exportOnlyApproved) args.push('--export-only-approved');
  args.push(...splitArgs(inputs.downloadTranslationsArgs));
  return args;
}

export function downloadBundleArgs(inputs: Inputs): string[] {
  return ['bundle', 'download', ...splitArgs(inputs.downloadBundle), ...globalArgs(inputs, false)];
}
