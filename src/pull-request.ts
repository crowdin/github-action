import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { splitList } from './args.js';
import type { Inputs } from './inputs.js';

type Octokit = ReturnType<typeof getOctokit>;

export interface PullRequestResult {
  created: boolean;
  url?: string;
  number?: number;
}

/** Resolves the GitHub REST API base URL from the `github_base_url` / `github_api_base_url` inputs. */
export function apiBaseUrl(inputs: Pick<Inputs, 'githubBaseUrl' | 'githubApiBaseUrl'>): string {
  const host = inputs.githubApiBaseUrl || `api.${inputs.githubBaseUrl}`;
  const url = /^https?:\/\//.test(host) ? host : `https://${host}`;
  return url.replace(/\/+$/, '');
}

/** The branch the pull request targets, mirroring the former entrypoint.sh logic. */
export function resolveBaseBranch(inputs: Pick<Inputs, 'pullRequestBaseBranchName'>, env = process.env): string {
  if (inputs.pullRequestBaseBranchName) return inputs.pullRequestBaseBranchName;
  if (env.GITHUB_HEAD_REF) return env.GITHUB_HEAD_REF;
  return (env.GITHUB_REF ?? '').replace(/^refs\/heads\//, '');
}

function httpStatus(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : undefined;
}

export async function createPullRequest(
  inputs: Inputs,
  authToken: string,
  branch: string,
  octokit: Octokit = getOctokit(authToken, { baseUrl: apiBaseUrl(inputs) }),
  env = process.env,
): Promise<PullRequestResult> {
  const [owner, repo] = (env.GITHUB_REPOSITORY ?? '').split('/');
  if (!owner || !repo) throw new Error('GITHUB_REPOSITORY is not set');

  const base = resolveBaseBranch(inputs, env);

  core.info('CHECK IF PULL REQUEST ALREADY EXIST');
  let existing;
  try {
    existing = await octokit.rest.pulls.list({ owner, repo, base, head: `${owner}:${branch}` });
  } catch (error) {
    const status = httpStatus(error);
    if (status === 401 || status === 403) {
      throw new Error('FAILED TO AUTHENTICATE WITH GITHUB. PLEASE CHECK YOUR GITHUB TOKEN');
    }
    throw new Error(`Failed to fetch pull requests: ${(error as Error).message}`);
  }

  if (existing.data.some((pr) => pr.head.ref === branch)) {
    core.info('PULL REQUEST ALREADY EXIST');
    return { created: false };
  }

  core.info('CREATE PULL REQUEST');
  let pr;
  try {
    pr = await octokit.rest.pulls.create({
      owner,
      repo,
      title: inputs.pullRequestTitle,
      base,
      head: branch,
      ...(inputs.pullRequestBody ? { body: inputs.pullRequestBody } : {}),
    });
  } catch (error) {
    throw new Error(`FAILED TO CREATE PULL REQUEST: ${(error as Error).message}`);
  }

  const { number, html_url: url } = pr.data;

  const labels = splitList(inputs.pullRequestLabels);
  if (labels.length) {
    core.info('ADD LABELS TO PULL REQUEST');
    await octokit.rest.issues
      .addLabels({ owner, repo, issue_number: number, labels })
      .catch((error: Error) => core.warning(`Failed to add labels: ${error.message}`));
  }

  const assignees = splitList(inputs.pullRequestAssignees);
  if (assignees.length) {
    core.info('ADD ASSIGNEES TO PULL REQUEST');
    await octokit.rest.issues
      .addAssignees({ owner, repo, issue_number: number, assignees })
      .catch((error: Error) => core.warning(`Failed to add assignees: ${error.message}`));
  }

  const reviewers = splitList(inputs.pullRequestReviewers);
  const teamReviewers = splitList(inputs.pullRequestTeamReviewers);
  if (reviewers.length || teamReviewers.length) {
    if (reviewers.length) core.info('ADD REVIEWERS TO PULL REQUEST');
    if (teamReviewers.length) core.info('ADD TEAM REVIEWERS TO PULL REQUEST');
    await octokit.rest.pulls
      .requestReviewers({ owner, repo, pull_number: number, reviewers, team_reviewers: teamReviewers })
      .catch((error: Error) => core.warning(`Failed to add reviewers: ${error.message}`));
  }

  core.info(`PULL REQUEST CREATED: ${url}`);
  return { created: true, url, number };
}
