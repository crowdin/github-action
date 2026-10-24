import { describe, expect, it } from 'vitest';
import {
  customCommandArgs,
  downloadBundleArgs,
  downloadSourcesArgs,
  downloadTranslationsArgs,
  globalArgs,
  splitArgs,
  splitList,
  uploadSourcesArgs,
  uploadTranslationsArgs,
} from '../src/args.js';
import type { Inputs } from '../src/inputs.js';

const base = {
  uploadSourcesArgs: '',
  uploadLanguage: '',
  autoApproveImported: false,
  importEqSuggestions: false,
  uploadTranslationsArgs: '',
  downloadSourcesArgs: '',
  downloadLanguage: '',
  language: '',
  downloadBundle: '',
  skipUntranslatedStrings: false,
  skipUntranslatedFiles: false,
  exportOnlyApproved: false,
  downloadTranslationsArgs: '',
  crowdinBranchName: '',
  config: '',
  dryrunAction: false,
  projectId: '',
  token: '',
  baseUrl: '',
  basePath: '',
  source: '',
  translation: '',
  command: '',
  commandArgs: '',
  debugMode: false,
} as Inputs;

const inputs = (overrides: Partial<Inputs> = {}): Inputs => ({ ...base, ...overrides });

describe('splitArgs', () => {
  it('splits on whitespace', () => {
    expect(splitArgs('  -l uk\t--method  tm \n--branch main ')).toEqual(['-l', 'uk', '--method', 'tm', '--branch', 'main']);
  });

  it('honours quotes and escapes', () => {
    expect(splitArgs(`--label "a b" --x='c "d"' e\\ f ""`)).toEqual(['--label', 'a b', '--x=c "d"', 'e f', '']);
    expect(splitArgs('"say \\"hi\\""')).toEqual(['say "hi"']);
  });

  it('keeps Windows paths intact', () => {
    expect(splitArgs('--config=C:\\a\\crowdin.yml')).toEqual(['--config=C:\\a\\crowdin.yml']);
  });

  it('returns no args for empty input', () => {
    expect(splitArgs('')).toEqual([]);
  });

  it('rejects unterminated quotes', () => {
    expect(() => splitArgs('"abc')).toThrow(/Unterminated/);
  });
});

describe('splitList', () => {
  it('splits by comma and trims', () => {
    expect(splitList('a, b,c ,, d')).toEqual(['a', 'b', 'c', 'd']);
    expect(splitList('')).toEqual([]);
  });
});

describe('globalArgs', () => {
  it('builds options in the entrypoint.sh order', () => {
    expect(
      globalArgs(
        inputs({
          debugMode: true,
          config: 'crowdin.yml',
          dryrunAction: true,
          projectId: '1',
          token: 't',
          baseUrl: 'https://api.crowdin.com',
          basePath: '.',
          source: 's/*.json',
          translation: 't/%locale%.json',
          commandArgs: '--verbose',
          crowdinBranchName: 'main',
        }),
      ),
    ).toEqual([
      '--no-progress',
      '--no-colors',
      '--verbose',
      '--debug',
      '--config=crowdin.yml',
      '--dryrun',
      '--project-id=1',
      '--token=t',
      '--base-url=https://api.crowdin.com',
      '--base-path=.',
      '--source=s/*.json',
      '--translation=t/%locale%.json',
      '--verbose',
      '--branch=main',
    ]);
  });

  it('omits --branch for bundles', () => {
    expect(downloadBundleArgs(inputs({ downloadBundle: '7', crowdinBranchName: 'main' }))).toEqual([
      'bundle',
      'download',
      '7',
      '--no-progress',
      '--no-colors',
    ]);
  });
});

describe('command args', () => {
  it('runs custom commands without global options', () => {
    expect(customCommandArgs(inputs({ command: 'string list', commandArgs: '--verbose', token: 't' }))).toEqual([
      'string',
      'list',
      '--verbose',
    ]);
  });

  it('builds upload sources args', () => {
    expect(uploadSourcesArgs(inputs({ uploadSourcesArgs: '--no-auto-update' }))).toEqual([
      'upload',
      'sources',
      '--no-progress',
      '--no-colors',
      '--no-auto-update',
    ]);
  });

  it('builds upload translations args', () => {
    expect(
      uploadTranslationsArgs(
        inputs({ uploadLanguage: 'uk', autoApproveImported: true, importEqSuggestions: true, uploadTranslationsArgs: '--x' }),
      ),
    ).toEqual([
      'upload',
      'translations',
      '--no-progress',
      '--no-colors',
      '--language=uk',
      '--auto-approve-imported',
      '--import-eq-suggestions',
      '--x',
    ]);
  });

  it('builds download sources args', () => {
    expect(downloadSourcesArgs(inputs({ downloadSourcesArgs: '--reviewed' }))).toEqual([
      'download',
      'sources',
      '--no-progress',
      '--no-colors',
      '--reviewed',
    ]);
  });

  it('builds download translations args with the legacy language fallback', () => {
    expect(
      downloadTranslationsArgs(
        inputs({
          language: 'de',
          skipUntranslatedStrings: true,
          skipUntranslatedFiles: true,
          exportOnlyApproved: true,
          downloadTranslationsArgs: '--all',
        }),
      ),
    ).toEqual([
      'download',
      '--no-progress',
      '--no-colors',
      '--language=de',
      '--skip-untranslated-strings',
      '--skip-untranslated-files',
      '--export-only-approved',
      '--all',
    ]);
    expect(downloadTranslationsArgs(inputs({ language: 'de', downloadLanguage: 'uk' }))).toContain('--language=uk');
  });
});
