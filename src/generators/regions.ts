/**
 * Regions (plan Unit 5, R14): ignore/snapshot-region builds using the upstream
 * regions fixture pair. Baseline approved, then a diff build.
 */
import {
  captureWeb,
  noncedBranch,
  snapshotPath,
  type GeneratorContext,
  type GeneratedBuild,
} from './context';

export async function generateRegions(ctx: GeneratorContext): Promise<GeneratedBuild[]> {
  const master = noncedBranch('master', ctx.nonce);
  const baseYml = snapshotPath(ctx.profile, 'snapshots_list/regions_baseline.yml');
  const diffYml = snapshotPath(ctx.profile, 'snapshots_list/regions_diff.yml');

  const baseline = await captureWeb(ctx, { snapshotFile: baseYml, branch: master });
  await ctx.buildApi.waitForBuildFinished(baseline.id, ctx.project.readToken);
  await ctx.buildApi.reviewBuild(baseline.id, 'approve');

  const changed = await captureWeb(ctx, {
    snapshotFile: diffYml,
    branch: noncedBranch('regions-diff', ctx.nonce),
    targetBranch: master,
  });
  await ctx.buildApi.waitForBuildFinished(changed.id, ctx.project.readToken);

  return [
    {
      feature: 'regions',
      requirement: 'R14',
      label: 'regions: ignore/snapshot regions diff',
      buildId: changed.id,
      buildUrl: changed.url,
    },
  ];
}
