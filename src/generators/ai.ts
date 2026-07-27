/**
 * AI features (plan Unit 5, R12): AI diff / bug-classification / build summary.
 * Only meaningful on an AI-on tier (the orchestrator skips it on the AI-off tier).
 * Uses the upstream AI fixture pair; awaits completion (AI jobs run server-side).
 */
import {
  captureWeb,
  noncedBranch,
  snapshotPath,
  type GeneratorContext,
  type GeneratedBuild,
} from './context';

export async function generateAI(ctx: GeneratorContext): Promise<GeneratedBuild[]> {
  const master = noncedBranch('master', ctx.nonce);
  const baseYml = snapshotPath(ctx.profile, 'snapshots_list/ai_details_baseline.yml');
  const diffYml = snapshotPath(ctx.profile, 'snapshots_list/ai_details_diff.yml');

  const baseline = await captureWeb(ctx, { snapshotFile: baseYml, branch: master });
  await ctx.buildApi.waitForBuildFinished(baseline.id, ctx.project.readToken);
  await ctx.buildApi.reviewBuild(baseline.id, 'approve');

  const changed = await captureWeb(ctx, {
    snapshotFile: diffYml,
    branch: noncedBranch('ai-diff', ctx.nonce),
    targetBranch: master,
  });
  await ctx.buildApi.waitForBuildFinished(changed.id, ctx.project.readToken);

  return [
    {
      feature: 'ai',
      requirement: 'R12',
      label: 'AI diff / bug-classification / build summary',
      buildId: changed.id,
      buildUrl: changed.url,
    },
  ];
}
