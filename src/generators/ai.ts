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

  // AI defaults to OFF on a fresh project; without this nothing is classified and
  // `ai-details.total-diffs-reduced` stays null. Dash-cased — Percy answers 200 and
  // silently ignores snake_cased keys.
  await ctx.projectApi.editProject(ctx.project.slug, { 'ai-enabled': true });

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

  // Bug classification (the third R12 capability). Upstream's fixtures point at
  // external sites (a random-content joke page and a GitHub Pages demo), which can't
  // give a testbed a reproducible diff — so this uses the in-repo `visual-bugs`
  // variant instead: five distinct defects Percy should mark as irregularities.
  const bugMaster = noncedBranch('ai-bug-classification-master', ctx.nonce);
  const bugBaseline = await captureWeb(ctx, { diffMode: 'baseline', branch: bugMaster });
  await ctx.buildApi.waitForBuildFinished(bugBaseline.id, ctx.project.readToken);
  await ctx.buildApi.reviewBuild(bugBaseline.id, 'approve');

  const bugged = await captureWeb(ctx, {
    diffMode: 'visual-bugs',
    branch: noncedBranch('ai-bug-classification', ctx.nonce),
    targetBranch: bugMaster,
  });
  await ctx.buildApi.waitForBuildFinished(bugged.id, ctx.project.readToken);
  out.push({
    feature: 'ai',
    requirement: 'R12',
    label: 'AI visual bug classification (5 deliberate defects)',
    expectation:
      'Regions should be marked as irregularities with a reason, not just "changed": carousel text unreadable on its background, banner copy clipped mid-word, price-table row misaligned with an overlapping value, ad image failing to load, sidebar overlapping the main column.',
    buildId: bugged.id,
    buildUrl: bugged.url,
  });

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
