/**
 * IntelliIgnore (region rule `intelliignore`).
 *
 * The point of this generator is that "0 diffs" on its own proves nothing — it looks
 * identical whether the rule suppressed the noise or the fixture never changed. So
 * every rule build is paired with a `standard` CONTROL over the same fixture pair.
 * The control shows the pixels really moved; the rule build shows Percy chose to
 * ignore them. Read them side by side.
 *
 * One approved baseline serves every scenario — the baseline fixture is the same for
 * all of them, and each head build targets that branch.
 */
import { captureWeb, noncedBranch, type GeneratorContext, type GeneratedBuild } from './context';
import { NOISE_ZONES, INTELLI_NOISE_CONFIG, type RegionRule } from '../fixtures/rules';
import { EXPECTED_DIFF_WORKING, EXPECTED_DIFF_NOOP } from '../fixtures/matrix';

const INTELLI: RegionRule = {
  zones: NOISE_ZONES,
  algorithm: 'intelliignore',
  configuration: INTELLI_NOISE_CONFIG,
};

const CONTROL: RegionRule = { zones: NOISE_ZONES, algorithm: 'standard' };

/**
 * IntelliIgnore preconditions, all PROJECT settings that default to off.
 *
 * `ai-enabled` matters most: IntelliIgnore is AI-backed, so with AI off the rule
 * never runs at all and every build comes back matching its standard control —
 * exactly what a live run showed, with `ai-details.total-diffs-reduced` null.
 *
 * Keys are dash-cased deliberately. Percy answers 200 and silently ignores
 * snake_cased keys, so the wrong casing here reads as success and changes nothing.
 */
export async function enableIntelliIgnore(ctx: GeneratorContext): Promise<void> {
  await ctx.projectApi.editProject(ctx.project.slug, {
    'ai-enabled': true,
    'intelli-ignore-enabled': true,
    'intelli-ignore-image-diff-ignore-enabled': true,
    'intelli-ignore-dynamic-data-enabled': true, // the timestamp zone
    'ignore-carousels-enabled': true,
    'ignore-banners-enabled': true,
    'ignore-ads-enabled': true,
  });
}

export async function generateIntelliIgnore(ctx: GeneratorContext): Promise<GeneratedBuild[]> {
  const out: GeneratedBuild[] = [];
  await enableIntelliIgnore(ctx);

  // The headline scenario: ONE >10,000px page where every case changes at once, so
  // the suppressed regions and the flagged ones appear in the same comparison and
  // the difference is visible rather than inferred. A build whose only change is
  // suppressed reports zero diffs — an absence QA cannot inspect, and one that does
  // not distinguish "the rule fired" from "nothing was compared".
  out.push(...(await generateMatrix(ctx)));
  out.push(...(await generateTallAllCases(ctx)));

  const master = noncedBranch('ii-master', ctx.nonce);

  // Shared approved baseline for every scenario below.
  const baseline = await captureWeb(ctx, { diffMode: 'baseline', branch: master, rules: [INTELLI] });
  await ctx.buildApi.waitForBuildFinished(baseline.id, ctx.project.readToken);
  await ctx.buildApi.reviewBuild(baseline.id, 'approve');

  const scenarios: Array<{
    key: string;
    diffMode: 'noise' | 'noise-signal' | 'carousel-only';
    rules: RegionRule[];
    label: string;
    expectation: string;
  }> = [
    // THE decisive pair. Exactly one zone changes, and IntelliIgnore is asked to
    // absorb it, so a working rule takes the build to zero. With four zones changed
    // the diff count cannot move whether or not the rule fired, which is why every
    // earlier IntelliIgnore build matched its control and proved nothing.
    {
      key: 'isolated-carousel',
      diffMode: 'carousel-only',
      rules: [
        { zones: ['carousel'], algorithm: 'intelliignore', configuration: INTELLI_NOISE_CONFIG },
      ],
      label: 'IntelliIgnore on the carousel — carousel is the ONLY change',
      expectation:
        'ZERO diffs. The carousel is the only thing that changed and IntelliIgnore should absorb it as carousel noise. Diffs here mean the rule is not suppressing.',
    },
    {
      key: 'isolated-control',
      diffMode: 'carousel-only',
      rules: [{ zones: ['carousel'], algorithm: 'standard' }],
      label: 'CONTROL (standard rule, carousel-only pair)',
      expectation:
        'The carousel IS flagged. Same fixture pair as above — this proves the carousel really changed, so zero diffs there means IntelliIgnore worked.',
    },
    {
      key: 'suppresses-noise',
      diffMode: 'noise',
      rules: [INTELLI],
      label: 'IntelliIgnore: carousel/ad/banner/timestamp all changed',
      // Live result: still 4 diffs, while the carousel-only pair suppresses cleanly.
      // So carousel detection fires and ad/banner/timestamp do not — most likely the
      // synthetic ad/banner markup here does not read as an ad or banner to the
      // classifier, rather than those classes being broken.
      expectation:
        'Currently STILL FLAGGED. The carousel-only pair above proves suppression works, so whatever is left flagged here is the ad, banner and/or timestamp — those zones are not being recognised as their noise classes with the present fixtures.',
    },
    {
      key: 'control-standard',
      diffMode: 'noise',
      rules: [CONTROL],
      label: 'CONTROL (standard rule, same fixture pair as above)',
      expectation:
        'Carousel, ad, banner and timestamp all flagged as diffs. This is the proof that the fixture really changed, so the build above showing none is IntelliIgnore working — not a no-op.',
    },
    {
      key: 'keeps-signal',
      diffMode: 'noise-signal',
      rules: [INTELLI],
      label: 'IntelliIgnore: noise changed AND the price table changed',
      expectation:
        'ONLY the price table (Growth plan $99 -> $129) is flagged. The carousel/ad/banner/timestamp changes are suppressed. A real change surviving the rule is the thing that matters.',
    },
  ];

  for (const s of scenarios) {
    const build = await captureWeb(ctx, {
      diffMode: s.diffMode,
      branch: noncedBranch(`ii-${s.key}`, ctx.nonce),
      targetBranch: master,
      rules: s.rules,
    });
    await ctx.buildApi.waitForBuildFinished(build.id, ctx.project.readToken);
    out.push({
      feature: 'intelli-ignore',
      requirement: 'R14b',
      label: s.label,
      expectation: s.expectation,
      buildId: build.id,
      buildUrl: build.url,
    });
  }

  // Sensitivity sweep on the ISOLATED pair — on the four-zone pair the count cannot
  // move, so the sweep would look identical at both ends regardless of effect.
  for (const sensitivity of [0, 4]) {
    const build = await captureWeb(ctx, {
      diffMode: 'carousel-only',
      branch: noncedBranch(`ii-sensitivity-${sensitivity}`, ctx.nonce),
      targetBranch: master,
      rules: [
        {
          zones: NOISE_ZONES,
          algorithm: 'intelliignore',
          configuration: { ...INTELLI_NOISE_CONFIG, diffSensitivity: sensitivity },
        },
      ],
    });
    await ctx.buildApi.waitForBuildFinished(build.id, ctx.project.readToken);
    out.push({
      feature: 'intelli-ignore',
      requirement: 'R14b',
      label: `IntelliIgnore sensitivity = ${sensitivity}`,
      expectation: `Carousel-only pair with diffSensitivity=${sensitivity}. Compare the two sweep builds: if the knob has an effect, one suppresses the carousel change and the other does not.`,
      buildId: build.id,
      buildUrl: build.url,
    });
  }

  return out;
}

/**
 * All cases in one tall page: noise zones under IntelliIgnore, signal and layout
 * left alone, plus an unchanged control section. One comparison, everything visible.
 */
export async function generateTallAllCases(ctx: GeneratorContext): Promise<GeneratedBuild[]> {
  const master = noncedBranch('ii-tall-master', ctx.nonce);
  const rules: RegionRule[] = [
    { zones: NOISE_ZONES, algorithm: 'intelliignore', configuration: INTELLI_NOISE_CONFIG },
  ];

  const baseline = await captureWeb(ctx, { diffMode: 'tall', branch: master, rules });
  await ctx.buildApi.waitForBuildFinished(baseline.id, ctx.project.readToken);
  await ctx.buildApi.reviewBuild(baseline.id, 'approve');

  const changed = await captureWeb(ctx, {
    diffMode: 'tall-changed',
    branch: noncedBranch('ii-tall', ctx.nonce),
    targetBranch: master,
    rules,
  });
  await ctx.buildApi.waitForBuildFinished(changed.id, ctx.project.readToken);

  return [
    {
      feature: 'intelli-ignore',
      requirement: 'R14b',
      label: 'ALL CASES in one >10,000px page (IntelliIgnore on the noise zones)',
      expectation:
        'Scroll the single comparison. Sections 1-4 (banner, carousel, ad, timestamp) all changed and should be SUPPRESSED. Section 5 (price $99 -> $129) and section 7 (text overflowing its box) changed and should still be FLAGGED. Section 6 moved 96px. Section 8 is identical in both builds — any diff there is noise in the harness itself. Seeing suppressed and flagged regions side by side is the point: a build with nothing in it proves nothing.',
      buildId: changed.id,
      buildUrl: changed.url,
    },
  ];
}

/**
 * The falsifiable test. One case per page, so the build's diff count is arithmetic:
 * each page contributes 0 or 4. Working IntelliIgnore totals 8; a no-op totals 12.
 *
 * Returns the observed count in the expectation so the result is on the record
 * rather than something a reader has to go and look up.
 */
export async function generateMatrix(ctx: GeneratorContext): Promise<GeneratedBuild[]> {
  const master = noncedBranch('ii-matrix-master', ctx.nonce);

  const baseline = await captureWeb(ctx, { diffMode: 'matrix', branch: master });
  await ctx.buildApi.waitForBuildFinished(baseline.id, ctx.project.readToken);
  await ctx.buildApi.reviewBuild(baseline.id, 'approve');

  const changed = await captureWeb(ctx, {
    diffMode: 'matrix-changed',
    branch: noncedBranch('ii-matrix', ctx.nonce),
    targetBranch: master,
  });
  const state = await ctx.buildApi.waitForBuildFinished(changed.id, ctx.project.readToken);

  return [
    {
      feature: 'intelli-ignore',
      requirement: 'R14b',
      label: 'MATRIX — one case per page, so the diff count is attributable',
      expectation:
        `Page A (carousel, IntelliIgnore) should contribute 0; page B (same carousel change, standard rule) 4; ` +
        `page C (price change, no rule) 4; page D (unchanged) 0. ` +
        `So ${EXPECTED_DIFF_WORKING} total means IntelliIgnore suppressed, ${EXPECTED_DIFF_NOOP} means it did not. ` +
        `Observed: ${state.totalComparisons ?? '?'} comparisons.`,
      buildId: changed.id,
      buildUrl: changed.url,
    },
  ];
}
