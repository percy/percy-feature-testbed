/**
 * Regions (plan Unit 5, R14) — now covering every rule in Percy's region model
 * (`standard | layout | ignore | intelliignore`), applied declaratively per snapshot.
 *
 * `ignore` and `layout` each get a paired `standard` control over the same fixture
 * pair, for the same reason IntelliIgnore does: a build with no diffs is only
 * evidence if something else proves the pixels moved.
 *
 * IntelliIgnore has its own generator (`intelli-ignore`) — it carries the most
 * scenarios, so it does not share this one.
 */
import { captureWeb, noncedBranch, type GeneratorContext, type GeneratedBuild } from './context';
import { NOISE_ZONES, type RegionRule } from '../fixtures/rules';

export async function generateRegions(ctx: GeneratorContext): Promise<GeneratedBuild[]> {
  const out: GeneratedBuild[] = [];
  const master = noncedBranch('regions-master', ctx.nonce);

  const baseline = await captureWeb(ctx, { diffMode: 'baseline', branch: master });
  await ctx.buildApi.waitForBuildFinished(baseline.id, ctx.project.readToken);
  await ctx.buildApi.reviewBuild(baseline.id, 'approve');

  const scenarios: Array<{
    key: string;
    diffMode: 'noise' | 'layout-shift' | 'carousel-only';
    rules: RegionRule[];
    label: string;
    expectation: string;
  }> = [
    // The decisive pair. Only the carousel differs, so ignoring it should take the
    // build to ZERO diffs. With four zones changed the count cannot move regardless
    // of whether the rule fired, which makes that version of the test unfalsifiable.
    {
      key: 'ignore-isolated',
      diffMode: 'carousel-only',
      rules: [{ zones: ['carousel'], algorithm: 'ignore' }],
      label: 'ignore region on the carousel — carousel is the ONLY change',
      expectation:
        'ZERO diffs. The carousel is the only thing that changed and it is ignored, so nothing should be flagged. If this build shows diffs, the ignore rule is not being applied.',
    },
    {
      key: 'ignore-isolated-control',
      diffMode: 'carousel-only',
      rules: [{ zones: ['carousel'], algorithm: 'standard' }],
      label: 'CONTROL (standard rule, carousel-only pair)',
      expectation:
        'The carousel IS flagged. Same fixture pair as the build above — this is what proves the carousel really changed, so zero diffs there means the rule worked.',
    },
    {
      key: 'ignore-carousel',
      diffMode: 'noise',
      rules: [{ zones: ['carousel'], algorithm: 'ignore' }],
      label: 'ignore region on the carousel (all four zones changed)',
      expectation:
        'Still flagged, because the ad, banner and timestamp also changed and are not ignored. Included to show why the isolated pair above is the meaningful test.',
    },
    {
      key: 'layout-rule',
      diffMode: 'layout-shift',
      rules: [{ zones: ['sidebar'], algorithm: 'layout' }],
      label: 'layout rule on a sidebar that moved but did not change',
      // Live runs give layout=4 diffs and standard=0 on this identical pair, i.e. the
      // opposite of "layout suppresses movement". Stated as a comparison rather than a
      // prediction, because the direction is not yet confirmed against Percy's docs —
      // the rule may be designed to DETECT layout change rather than ignore it.
      expectation:
        'The sidebar moved 96px down with identical content. Compare against the standard control below and confirm which way round Percy treats it — on the current fixtures the layout rule flags this pair and standard does not.',
    },
    {
      key: 'layout-control',
      diffMode: 'layout-shift',
      rules: [{ zones: ['sidebar'], algorithm: 'standard' }],
      label: 'CONTROL (standard rule over the same layout shift)',
      expectation:
        'The same displacement judged pixel-wise. Read alongside the layout build above — the pair is what tells you how each rule treats pure movement.',
    },
  ];

  for (const s of scenarios) {
    const build = await captureWeb(ctx, {
      diffMode: s.diffMode,
      branch: noncedBranch(`regions-${s.key}`, ctx.nonce),
      targetBranch: master,
      rules: s.rules,
    });
    await ctx.buildApi.waitForBuildFinished(build.id, ctx.project.readToken);
    out.push({
      feature: 'regions',
      requirement: 'R14',
      label: s.label,
      expectation: s.expectation,
      buildId: build.id,
      buildUrl: build.url,
    });
  }

  return out;
}
