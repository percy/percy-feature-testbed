/**
 * AI features (plan Unit 5, R12) — now backed by real rendered pages.
 *
 * Reuses the curated upstream fixtures in `percy_playwright/test_bed/ai` IN PLACE
 * (no vendoring, per the repo's upstream rule): eight realistic baseline/changed
 * page pairs for the AI build summary, and a reduce-diff pair for AI diff review.
 * Solid-colour blocks gave the classifier nothing to classify; these pages have
 * headings, alerts, tables and copy, so an AI summary has real content to describe.
 */
import { join } from 'node:path';
import { captureWeb, noncedBranch, type GeneratorContext, type GeneratedBuild } from './context';

/** Where the upstream AI fixtures live, relative to the percy_playwright checkout. */
export function aiFixtureDir(percyPlaywrightRoot: string, suite: 'build-summary' | 'ai-details', side: 'baseline' | 'changed'): string {
  return join(percyPlaywrightRoot, 'test_bed', 'ai', suite, side);
}

export async function generateAI(ctx: GeneratorContext): Promise<GeneratedBuild[]> {
  const out: GeneratedBuild[] = [];
  const root = ctx.profile.upstream.percyPlaywright;

  const suites: Array<{
    suite: 'build-summary' | 'ai-details';
    key: string;
    label: string;
    expectation: string;
  }> = [
    {
      suite: 'build-summary',
      key: 'ai-summary',
      label: 'AI build summary over 8 realistic page pairs',
      expectation:
        'The build summary should describe the changes in words a human recognises (copy edits, figures, status changes) across the eight pages — not just report a diff count.',
    },
    {
      suite: 'ai-details',
      key: 'ai-reduce-diff',
      label: 'AI diff review / reduce-diff',
      expectation:
        'The AI details panel should appear on the changed comparison and reduce or explain the diff rather than flag the whole page.',
    },
  ];

  for (const s of suites) {
    const master = noncedBranch(`ai-${s.key}-master`, ctx.nonce);

    const baseline = await captureWeb(ctx, {
      branch: master,
      sourceDir: aiFixtureDir(root, s.suite, 'baseline'),
    });
    await ctx.buildApi.waitForBuildFinished(baseline.id, ctx.project.readToken);
    await ctx.buildApi.reviewBuild(baseline.id, 'approve');

    const changed = await captureWeb(ctx, {
      branch: noncedBranch(`ai-${s.key}`, ctx.nonce),
      targetBranch: master,
      sourceDir: aiFixtureDir(root, s.suite, 'changed'),
    });
    await ctx.buildApi.waitForBuildFinished(changed.id, ctx.project.readToken);

    out.push({
      feature: 'ai',
      requirement: 'R12',
      label: s.label,
      expectation: s.expectation,
      buildId: changed.id,
      buildUrl: changed.url,
    });
  }

  return out;
}
