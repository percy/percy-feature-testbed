/**
 * Recurring diff (plan Unit 5, R11). An approved master baseline, then two
 * consecutive changed builds against it so the same diff recurs and the
 * recurring-diff nudge fires. Uses its own baseline branch — sharing `master` with
 * `core` meant core's identical price diff had already occurred once, so the
 * "first occurrence" build was mislabelled and the nudge could fire a build early.
 */
import { captureWeb, noncedBranch, type GeneratorContext, type GeneratedBuild } from './context';

export async function generateRecurringDiff(ctx: GeneratorContext): Promise<GeneratedBuild[]> {
  const out: GeneratedBuild[] = [];
  const master = noncedBranch('rd-master', ctx.nonce);

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
      expectation:
        i === 1
          ? 'First occurrence of the price-table change ($99 -> $129) against the baseline — no nudge yet.'
          : 'The SAME price-table change recurring a second time — the recurring-diff nudge should appear here.',
      buildId: diff.id,
      buildUrl: diff.url,
    });
  }
  return out;
}
