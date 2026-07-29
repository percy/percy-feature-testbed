/**
 * AI features (plan Unit 5, R12). Approved baseline + a changed build so an AI
 * review runs. NOTE: on the image-upload path this is a smoke build — real AI
 * diff/bug-classification needs rendered pages with meaningful content; static
 * color-blocks only exercise the pipeline, not the classifier's quality.
 */
import { captureWeb, noncedBranch, type GeneratorContext, type GeneratedBuild } from './context';

export async function generateAI(ctx: GeneratorContext): Promise<GeneratedBuild[]> {
  const master = noncedBranch('master', ctx.nonce);

  const baseline = await captureWeb(ctx, { diffMode: 'baseline', branch: master });
  await ctx.buildApi.waitForBuildFinished(baseline.id, ctx.project.readToken);
  await ctx.buildApi.reviewBuild(baseline.id, 'approve');

  const changed = await captureWeb(ctx, {
    diffMode: 'changed',
    branch: noncedBranch('ai-diff', ctx.nonce),
    targetBranch: master,
  });
  await ctx.buildApi.waitForBuildFinished(changed.id, ctx.project.readToken);

  return [
    {
      feature: 'ai',
      requirement: 'R12',
      label: 'AI review (image-upload smoke build; real classification needs rendered pages)',
      buildId: changed.id,
      buildUrl: changed.url,
    },
  ];
}
