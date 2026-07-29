/**
 * Real dispatch: assemble live dependencies and run the one-pass orchestrator, then
 * print the run summary. Wired into the CLI as the default dispatch.
 *
 * The per-tier `provisionProject` is the one genuinely live/deferred piece: on shared
 * envs the account matrix must already exist and a user principal + tokens must be
 * fetchable — the exact mechanism is a Phase-0 confirmation item (plan Unit 8). Until
 * Phase-0 defines it, this throws a clear, actionable error rather than faking success.
 */
import type { CliConfig } from './cli';
import { loadProfile } from './profile/loader';
import { fetchHttpClient } from './http';
import { spawnRunner } from './exec';
import { createProjectApi } from './percy/project-api';
import { createBuildApi } from './percy/build-api';
import { provisionProject } from './provisioning/accounts';
import { orchestrate, type OrchestratorDeps } from './orchestrator';
import { formatRunSummary } from './report';

export async function realDispatch(config: CliConfig): Promise<void> {
  const profile = await loadProfile(config.profile, { repoRoot: process.cwd() });
  const projectApi = createProjectApi(profile, fetchHttpClient);
  const buildApi = createBuildApi(profile, fetchHttpClient);

  const deps: OrchestratorDeps = {
    profile,
    projectApi,
    buildApi,
    runner: spawnRunner,
    nonce: profile.nonceSeed,
    // Real provisioning (public Percy flow): create a project via the account's
    // Basic-auth creds, then fetch its write + read tokens. One project per tier.
    // NOTE: fetchProjectToken is not fully public-documented — validate on first run.
    provisionProject: (tier) =>
      provisionProject(projectApi, `testbed-${tier}-${profile.nonceSeed}`, 'web'),
  };

  const result = await orchestrate(config, deps);
  console.log(formatRunSummary(result, profile));
}
