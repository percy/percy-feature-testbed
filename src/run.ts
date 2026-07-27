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
    provisionProject: async (tier) => {
      // Phase-0 must define how a per-tier org id + user principal + tokens are obtained
      // on the target env (the dev-only rake cannot run on shared envs). See plan Unit 8.
      throw new Error(
        `provisionProject("${tier}") is not wired for live runs yet — resolving the per-tier ` +
          'org id + user principal + project tokens on the target env is the Phase-0 deferred item. ' +
          'Run Unit 0 validation first (see docs/plans/2026-07-27-001-...-plan.md).',
      );
    },
  };

  const result = await orchestrate(config, deps);
  console.log(formatRunSummary(result, profile));
}
