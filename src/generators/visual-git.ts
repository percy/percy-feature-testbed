/**
 * Visual-git / target-branch baseline selection + A/B variant comparison (plan Unit 5, R9/R10).
 *
 * Creates a "variant A" target-branch build, approves it, then a "variant B" head build
 * with PERCY_TARGET_BRANCH pointing at variant A. "A/B testing" rides this same machinery.
 */
import { captureWeb, noncedBranch, type GeneratorContext, type GeneratedBuild } from './context';

export async function generateVisualGit(ctx: GeneratorContext): Promise<GeneratedBuild[]> {
  const out: GeneratedBuild[] = [];
  const variantA = noncedBranch('variant-a', ctx.nonce);

  const a = await captureWeb(ctx, { diffMode: 'baseline', branch: variantA });
  await ctx.buildApi.waitForBuildFinished(a.id, ctx.project.readToken);
  await ctx.buildApi.reviewBuild(a.id, 'approve');
  out.push({
    feature: 'visual-git',
    requirement: 'R9',
    label: 'visual-git: variant-A target-branch baseline',
    buildId: a.id,
    buildUrl: a.url,
  });

  const b = await captureWeb(ctx, {
    diffMode: 'changed',
    branch: noncedBranch('variant-b', ctx.nonce),
    targetBranch: variantA,
  });
  await ctx.buildApi.waitForBuildFinished(b.id, ctx.project.readToken);
  out.push({
    feature: 'visual-git',
    requirement: 'R10',
    label: 'A/B: variant-B vs variant-A (target-branch baseline)',
    buildId: b.id,
    buildUrl: b.url,
  });

  return out;
}
