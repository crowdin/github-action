import { describe, expect, it, vi } from 'vitest';
import { apiBaseUrl, createPullRequest, resolveBaseBranch } from '../src/pull-request.js';
import type { Inputs } from '../src/inputs.js';

vi.mock('@actions/core', () => ({ info: vi.fn(), warning: vi.fn() }));

const env = { GITHUB_REPOSITORY: 'octo/repo', GITHUB_REF: 'refs/heads/main' };

const inputs = (overrides: Partial<Inputs> = {}): Inputs =>
  ({
    githubBaseUrl: 'github.com',
    githubApiBaseUrl: '',
    pullRequestTitle: 'New translations',
    pullRequestBody: '',
    pullRequestLabels: '',
    pullRequestAssignees: '',
    pullRequestReviewers: '',
    pullRequestTeamReviewers: '',
    pullRequestBaseBranchName: '',
    ...overrides,
  }) as Inputs;

function mockOctokit(existing: { head: { ref: string } }[] = []) {
  return {
    rest: {
      pulls: {
        list: vi.fn().mockResolvedValue({ data: existing }),
        create: vi.fn().mockResolvedValue({ data: { number: 42, html_url: 'https://github.com/octo/repo/pull/42' } }),
        requestReviewers: vi.fn().mockResolvedValue({}),
      },
      issues: {
        addLabels: vi.fn().mockResolvedValue({}),
        addAssignees: vi.fn().mockResolvedValue({}),
      },
    },
  };
}

type OctokitArg = Parameters<typeof createPullRequest>[3];

describe('apiBaseUrl', () => {
  it('derives the API URL from github_base_url', () => {
    expect(apiBaseUrl({ githubBaseUrl: 'github.com', githubApiBaseUrl: '' })).toBe('https://api.github.com');
  });

  it('prefers github_api_base_url', () => {
    expect(apiBaseUrl({ githubBaseUrl: 'ghe.io', githubApiBaseUrl: 'ghe.io/api/v3' })).toBe('https://ghe.io/api/v3');
    expect(apiBaseUrl({ githubBaseUrl: 'ghe.io', githubApiBaseUrl: 'http://ghe.io/api/v3/' })).toBe('http://ghe.io/api/v3');
  });
});

describe('resolveBaseBranch', () => {
  it('uses the explicit input, then GITHUB_HEAD_REF, then GITHUB_REF', () => {
    expect(resolveBaseBranch(inputs({ pullRequestBaseBranchName: 'dev' }), env)).toBe('dev');
    expect(resolveBaseBranch(inputs(), { ...env, GITHUB_HEAD_REF: 'feature' })).toBe('feature');
    expect(resolveBaseBranch(inputs(), env)).toBe('main');
  });
});

describe('createPullRequest', () => {
  it('does nothing when a pull request already exists', async () => {
    const octokit = mockOctokit([{ head: { ref: 'l10n' } }]);
    const result = await createPullRequest(inputs(), 't', 'l10n', octokit as unknown as OctokitArg, env);
    expect(result).toEqual({ created: false });
    expect(octokit.rest.pulls.list).toHaveBeenCalledWith({ owner: 'octo', repo: 'repo', base: 'main', head: 'octo:l10n' });
    expect(octokit.rest.pulls.create).not.toHaveBeenCalled();
  });

  it('creates a pull request with labels, assignees and reviewers', async () => {
    const octokit = mockOctokit();
    const result = await createPullRequest(
      inputs({
        pullRequestBody: 'line 1\nline "2"',
        pullRequestLabels: 'l10n, crowdin',
        pullRequestAssignees: 'alice',
        pullRequestReviewers: 'bob,carol',
        pullRequestTeamReviewers: 'team',
      }),
      't',
      'l10n',
      octokit as unknown as OctokitArg,
      env,
    );

    expect(result).toEqual({ created: true, number: 42, url: 'https://github.com/octo/repo/pull/42' });
    expect(octokit.rest.pulls.create).toHaveBeenCalledWith({
      owner: 'octo',
      repo: 'repo',
      title: 'New translations',
      base: 'main',
      head: 'l10n',
      body: 'line 1\nline "2"',
    });
    expect(octokit.rest.issues.addLabels).toHaveBeenCalledWith({
      owner: 'octo',
      repo: 'repo',
      issue_number: 42,
      labels: ['l10n', 'crowdin'],
    });
    expect(octokit.rest.issues.addAssignees).toHaveBeenCalledWith({
      owner: 'octo',
      repo: 'repo',
      issue_number: 42,
      assignees: ['alice'],
    });
    expect(octokit.rest.pulls.requestReviewers).toHaveBeenCalledWith({
      owner: 'octo',
      repo: 'repo',
      pull_number: 42,
      reviewers: ['bob', 'carol'],
      team_reviewers: ['team'],
    });
  });

  it('does not fail when adding metadata fails', async () => {
    const octokit = mockOctokit();
    octokit.rest.issues.addLabels.mockRejectedValue(new Error('nope'));
    const result = await createPullRequest(
      inputs({ pullRequestLabels: 'x' }),
      't',
      'l10n',
      octokit as unknown as OctokitArg,
      env,
    );
    expect(result.created).toBe(true);
  });

  it('reports authentication failures', async () => {
    const octokit = mockOctokit();
    octokit.rest.pulls.list.mockRejectedValue(Object.assign(new Error('Bad credentials'), { status: 401 }));
    await expect(createPullRequest(inputs(), 't', 'l10n', octokit as unknown as OctokitArg, env)).rejects.toThrow(
      /FAILED TO AUTHENTICATE/,
    );
  });
});
