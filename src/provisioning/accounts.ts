/**
 * Account/project provisioning (plan Unit 8, R6).
 *
 *  - local: shell the dev-only rake (`dev:seed_test_accounts`) to fabricate the
 *    matrix, then create projects + fetch tokens.
 *  - shared: reference pre-provisioned accounts (the rake is Rails.env.development?
 *    gated and cannot run) and fetch tokens.
 *
 * The shared-env mechanism for resolving a team/org id + a user principal + tokens
 * is a Phase-0 confirmation item (see plan Open Questions).
 */
import type { Runner } from '../exec';
import type { ProjectApi } from '../percy/project-api';
import type { SeededProject } from '../generators/context';
import { assertSafeName } from '../preconditions';

/** Run the dev-only seed rake inside the api container to fabricate the matrix (local). */
export async function runLocalSeedRake(runner: Runner, tier?: string): Promise<void> {
  const task = tier ? `dev:seed_test_accounts[${tier}]` : 'dev:seed_test_accounts';
  const res = await runner('docker', ['compose', 'exec', '-T', 'api', 'bundle', 'exec', 'rake', task], {
    timeoutMs: 300_000,
  });
  if (res.code && res.code !== 0) {
    throw new Error(`seed rake "${task}" failed (exit ${res.code}): ${res.stderr.slice(-300)}`);
  }
}

/** Create a project in an org and fetch its write + read tokens. */
export async function provisionProject(
  projectApi: ProjectApi,
  teamId: string,
  projectName: string,
): Promise<SeededProject> {
  assertSafeName(projectName);
  const { id, slug } = await projectApi.createProject(teamId, projectName);
  const writeToken = await projectApi.fetchProjectToken(id, 'write_only');
  const readToken = await projectApi.fetchProjectToken(id, 'read');
  return { id, slug, teamId, writeToken, readToken };
}
