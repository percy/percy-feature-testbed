/**
 * Approval automation (plan R13): auto-finalization + supersede (Unit 5) and the
 * net-new auto-approve generator (Unit 6).
 */
import {
  captureWeb,
  noncedBranch,
  snapshotPath,
  type GeneratorContext,
  type GeneratedBuild,
} from './context';

/** Auto-finalization (R13): a normal finished build. */
export async function generateAutoFinalization(ctx: GeneratorContext): Promise<GeneratedBuild[]> {
  const b = await captureWeb(ctx, { diffMode: 'baseline', branch: noncedBranch('auto-finalize', ctx.nonce) });
  await ctx.buildApi.waitForBuildFinished(b.id, ctx.project.readToken);
  return [{ feature: 'approval', requirement: 'R13', label: 'auto-finalization', buildId: b.id, buildUrl: b.url }];
}

/**
 * Supersede (R13): two builds on the SAME branch with build caching skipped, so the
 * second supersedes the first. Requires squash_builds_enabled + the LD flag on the
 * project — a precondition the gate (Unit 8) is responsible for.
 */
export async function generateSupersede(ctx: GeneratorContext): Promise<GeneratedBuild[]> {
  const branch = noncedBranch('supersede', ctx.nonce);
  const yml = snapshotPath(ctx.profile, 'snapshots_list/supersede_snapshots.yml');

  const first = await captureWeb(ctx, { snapshotFile: yml, branch, skipCache: true });
  await ctx.buildApi.waitForBuildFinished(first.id, ctx.project.readToken);
  const second = await captureWeb(ctx, { snapshotFile: yml, branch, skipCache: true });
  await ctx.buildApi.waitForBuildFinished(second.id, ctx.project.readToken);

  return [
    {
      feature: 'approval',
      requirement: 'R13',
      label: 'supersede: 2nd build supersedes 1st (same branch)',
      buildId: second.id,
      buildUrl: second.url,
    },
  ];
}

/**
 * Auto-approve (R13, NET-NEW — Unit 6). Set an auto-approve branch rule via
 * editProject (USER principal — project tokens are rejected), build on a MATCHING
 * branch (should auto-approve), and a control build on a non-matching branch (should
 * NOT). The review-state is read back so a hung/unhandled review_state_reason surfaces.
 */
export async function generateAutoApprove(ctx: GeneratorContext): Promise<GeneratedBuild[]> {
  const out: GeneratedBuild[] = [];
  const prefix = 'auto-approved';

  await ctx.projectApi.setAutoApprove(ctx.project.teamId, ctx.project.slug, `${prefix}/*`);

  const matching = await captureWeb(ctx, { diffMode: 'changed', branch: noncedBranch(`${prefix}/x`, ctx.nonce) });
  const matchState = await ctx.buildApi.waitForBuildFinished(matching.id, ctx.project.readToken);
  out.push({
    feature: 'approval',
    requirement: 'R13',
    label: `auto-approve: matching branch (review-state=${matchState.reviewState ?? 'n/a'})`,
    buildId: matching.id,
    buildUrl: matching.url,
  });

  const control = await captureWeb(ctx, { diffMode: 'changed', branch: noncedBranch('not-matching', ctx.nonce) });
  await ctx.buildApi.waitForBuildFinished(control.id, ctx.project.readToken);
  out.push({
    feature: 'approval',
    requirement: 'R13',
    label: 'auto-approve: control (non-matching branch, should stay unapproved)',
    buildId: control.id,
    buildUrl: control.url,
  });

  return out;
}
