/**
 * Regions (plan Unit 5, R14). Approved baseline + a changed build. NOTE: on the
 * image-upload path, region ignore/snapshot config is NOT applied (that needs the
 * SDK/snapshot-config path); this produces the diff build but not configured regions.
 */
import { captureWeb, noncedBranch, type GeneratorContext, type GeneratedBuild } from './context';

export async function generateRegions(ctx: GeneratorContext): Promise<GeneratedBuild[]> {
  const master = noncedBranch('master', ctx.nonce);

  const baseline = await captureWeb(ctx, { diffMode: 'baseline', branch: master });
  await ctx.buildApi.waitForBuildFinished(baseline.id, ctx.project.readToken);
  await ctx.buildApi.reviewBuild(baseline.id, 'approve');

  const changed = await captureWeb(ctx, {
    diffMode: 'changed',
    branch: noncedBranch('regions-diff', ctx.nonce),
    targetBranch: master,
  });
  await ctx.buildApi.waitForBuildFinished(changed.id, ctx.project.readToken);

  return [
    {
      feature: 'regions',
      requirement: 'R14',
      label: 'regions (diff build; region config not applied on the upload path)',
      buildId: changed.id,
      buildUrl: changed.url,
    },
  ];
}
