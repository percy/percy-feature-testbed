/**
 * Recurring diff (plan Unit 5, R11). An approved master baseline, then two
 * consecutive changed builds against it so the same diff recurs and the
 * recurring-diff nudge fires. Image-based (`percy upload`) path.
 */
import { captureWeb, noncedBranch, type GeneratorContext, type GeneratedBuild } from './context';

export async function generateRecurringDiff(ctx: GeneratorContext): Promise<GeneratedBuild[]> {
  const out: GeneratedBuild[] = [];
  const master = noncedBranch('master', ctx.nonce);

  const baseline = await captureWeb(ctx, { diffMode: 'baseline', branch: master });
  await ctx.buildApi.waitForBuildFinished(baseline.id, ctx.project.readToken);
  await ctx.buildApi.reviewBuild(baseline.id, 'approve');

  for (let i = 1; i <= 2; i++) {
    const diff = await captureWeb(ctx, {
      diffMode: 'changed',
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
