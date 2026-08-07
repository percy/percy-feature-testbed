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
    diffMode: 'noise' | 'layout-shift';
    rules: RegionRule[];
    label: string;
    expectation: string;
  }> = [
    {
      key: 'ignore-carousel',
      diffMode: 'noise',
      rules: [{ zones: ['carousel'], algorithm: 'ignore' }],
      label: 'ignore region on the carousel',
      expectation:
        'The carousel change is NOT flagged; the ad, banner and timestamp changes still are. Only the ignored region drops out.',
    },
    {
      key: 'ignore-control',
      diffMode: 'noise',
      rules: [{ zones: NOISE_ZONES, algorithm: 'standard' }],
      label: 'CONTROL (standard rule over the same noise pair)',
      expectation:
        'All four noise zones flagged, carousel included — the control that makes the ignore build above meaningful.',
    },
    {
      key: 'layout-rule',
      diffMode: 'layout-shift',
      rules: [{ zones: ['sidebar'], algorithm: 'layout' }],
      label: 'layout rule on a sidebar that moved but did not change',
      expectation:
        'The sidebar moved 96px down with identical content. Under the layout rule this should not read as a content change.',
    },
    {
      key: 'layout-control',
      diffMode: 'layout-shift',
      rules: [{ zones: ['sidebar'], algorithm: 'standard' }],
      label: 'CONTROL (standard rule over the same layout shift)',
      expectation:
        'The same displacement, judged pixel-wise: the sidebar region IS flagged. Contrast with the layout build above.',
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
