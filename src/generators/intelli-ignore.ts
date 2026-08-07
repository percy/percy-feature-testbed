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
  const master = noncedBranch('ii-master', ctx.nonce);

  // Shared approved baseline for every scenario below.
  const baseline = await captureWeb(ctx, { diffMode: 'baseline', branch: master, rules: [INTELLI] });
  await ctx.buildApi.waitForBuildFinished(baseline.id, ctx.project.readToken);
  await ctx.buildApi.reviewBuild(baseline.id, 'approve');

  const scenarios: Array<{
    key: string;
    diffMode: 'noise' | 'noise-signal';
    rules: RegionRule[];
    label: string;
    expectation: string;
  }> = [
    {
      key: 'suppresses-noise',
      diffMode: 'noise',
      rules: [INTELLI],
      label: 'IntelliIgnore: carousel/ad/banner/timestamp all changed',
      expectation:
        'NO diffs flagged — every changed zone is noise IntelliIgnore should absorb. Compare against the control build below, which shows the same pixels did change.',
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

  // Sensitivity sweep — same fixture pair, opposite ends of the 0-4 knob.
  for (const sensitivity of [0, 4]) {
    const build = await captureWeb(ctx, {
      diffMode: 'noise',
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
      expectation: `Same fixture pair as the scenarios above, with diffSensitivity=${sensitivity}. Compare the two sweep builds against each other — the diff count should differ, showing the knob has an effect.`,
      buildId: build.id,
      buildUrl: build.url,
    });
  }

  return out;
}
