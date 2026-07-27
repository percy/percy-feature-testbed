/**
 * Recurring diff (plan Unit 5, R11). Two consecutive diff builds against an approved
 * master baseline so the same diff recurs and the recurring-diff nudge fires. Needs
 * >=2 processed builds — hence the await between each.
 */
import {
  captureWeb,
  noncedBranch,
  snapshotPath,
  type GeneratorContext,
  type GeneratedBuild,
} from './context';

const RECURRING_YML = 'snapshots_list/recurring_diff_snapshot.yml';

export async function generateRecurringDiff(ctx: GeneratorContext): Promise<GeneratedBuild[]> {
  const out: GeneratedBuild[] = [];
  const master = noncedBranch('master', ctx.nonce);
  const yml = snapshotPath(ctx.profile, RECURRING_YML);

  const baseline = await captureWeb(ctx, { snapshotFile: yml, branch: master });
  await ctx.buildApi.waitForBuildFinished(baseline.id, ctx.project.readToken);
  await ctx.buildApi.reviewBuild(baseline.id, 'approve');

  for (let i = 1; i <= 2; i++) {
    const diff = await captureWeb(ctx, {
      snapshotFile: yml,
      branch: noncedBranch(`recurring-${i}`, ctx.nonce),
      targetBranch: master,
    });
    await ctx.buildApi.waitForBuildFinished(diff.id, ctx.project.readToken);
    out.push({
      feature: 'recurring-diff',
      requirement: 'R11',
      label: `recurring diff build #${i}`,
      buildId: diff.id,
      buildUrl: diff.url,
    });
  }
  return out;
}
