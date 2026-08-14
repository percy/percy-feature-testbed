/**
 * Core review states generator (plan Unit 4, R8/R4/R3b).
 *
 * Produces an approved baseline then a CHANGED build that diffs against it. CHANGED
 * requires the baseline approved first (on canary, master is not the default branch,
 * so nothing auto-approves). The per-run nonce defeats auto-approve carry-forward.
 */
import { captureWeb, noncedBranch, type GeneratorContext, type GeneratedBuild } from './context';

export async function generateCoreStates(ctx: GeneratorContext): Promise<GeneratedBuild[]> {
  const out: GeneratedBuild[] = [];
  const masterBranch = noncedBranch('master', ctx.nonce);

  // 1. Baseline → await finish → approve (so the next build is classified CHANGED).
  const baseline = await captureWeb(ctx, { diffMode: 'baseline', branch: masterBranch });
  await ctx.buildApi.waitForBuildFinished(baseline.id, ctx.project.readToken);
  await ctx.buildApi.reviewBuild(baseline.id, 'approve');
  out.push({
    feature: 'core',
    requirement: 'R8',
    label: 'core: approved baseline',
    expectation:
      'Storefront and pricing pages render as real content (carousel, banner, price table). Approved, so it is the baseline the next build diffs against.',
    buildId: baseline.id,
    buildUrl: baseline.url,
  });

  // 2. Changed vs the approved baseline (target-branch points at the baseline branch).
  const changed = await captureWeb(ctx, {
    diffMode: 'changed',
    branch: noncedBranch('feature/seed-change', ctx.nonce),
    targetBranch: masterBranch,
  });
  await ctx.buildApi.waitForBuildFinished(changed.id, ctx.project.readToken);
  out.push({
    feature: 'core',
    requirement: 'R8',
    label: 'core: changed (diffs vs baseline)',
    expectation:
      'CHANGED review state: the Growth plan price moves $99 -> $129 on the storefront. Pricing page unchanged.',
    buildId: changed.id,
    buildUrl: changed.url,
  });

  return out;
}
