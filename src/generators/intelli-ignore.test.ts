import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateIntelliIgnore } from './intelli-ignore';
import { makeGeneratorContext } from '../testing/fakes';

function configsFrom(runnerCalls: { args: string[] }[]): any[] {
  return runnerCalls.map((c) => {
    const i = c.args.indexOf('--config');
    return i === -1 ? null : JSON.parse(readFileSync(c.args[i + 1], 'utf8'));
  });
}

test('intelli-ignore: enables AI + the noise classes before capturing', async () => {
  // All default to off. With AI off the rule never runs at all, and the rule builds
  // come back identical to their standard control.
  const { ctx, httpCalls } = makeGeneratorContext();
  await generateIntelliIgnore(ctx);

  const patch = httpCalls.find((c) => c.method === 'PATCH');
  assert.ok(patch, 'the project is patched');
  const attrs = (patch.body as any).data.attributes;
  for (const key of [
    'ai-enabled', // IntelliIgnore is AI-backed; off means the rule never runs
    'intelli-ignore-enabled',
    'ignore-carousels-enabled',
    'ignore-banners-enabled',
    'ignore-ads-enabled',
    'intelli-ignore-dynamic-data-enabled',
  ]) {
    assert.equal(attrs[key], true, `${key} enabled`);
  }
});

test('intelli-ignore: every rule build ships with a standard control', async () => {
  const { ctx } = makeGeneratorContext();
  const builds = await generateIntelliIgnore(ctx);

  // matrix + tall all-cases + 2 isolated + 3 four-zone scenarios + 2 sensitivity sweep.
  assert.equal(builds.length, 9);

  // The matrix build is the falsifiable one: its diff count differs between
  // "IntelliIgnore suppressed" and "IntelliIgnore did nothing".
  const matrix = builds.find((b) => /MATRIX/.test(b.label));
  assert.ok(matrix, 'a per-page matrix build exists');
  assert.match(String(matrix.expectation), /8 total means IntelliIgnore suppressed/);

  // The all-cases build is what QA actually inspects: suppressed and flagged regions
  // in one comparison, rather than a build with nothing in it.
  const allCases = builds.find((b) => /ALL CASES/.test(b.label));
  assert.ok(allCases, 'a single-page all-cases build exists');
  assert.match(String(allCases.expectation), /SUPPRESSED/);
  assert.match(String(allCases.expectation), /FLAGGED/);
  assert.ok(builds.every((b) => b.requirement === 'R14b'));
  assert.ok(builds.every((b) => b.expectation), 'every build states what QA should see');

  const controls = builds.filter((b) => b.label.startsWith('CONTROL'));
  assert.equal(controls.length, 2, 'a standard control per rule — "no diffs" alone proves nothing');

  // The decisive test: one zone changed, that zone suppressed, so zero is meaningful.
  const isolated = builds.find((b) => /ONLY change/.test(b.label));
  assert.ok(isolated, 'an isolated-change IntelliIgnore build exists');
  assert.match(String(isolated.expectation), /ZERO diffs/);
});

test('intelli-ignore: the rule and its control run over the same fixture pair', async () => {
  const { ctx, runnerCalls } = makeGeneratorContext();
  await generateIntelliIgnore(ctx);

  const cfgs = configsFrom(runnerCalls);
  const intelli = cfgs.filter((c) => JSON.stringify(c).includes('"algorithm":"intelliignore"'));
  const standard = cfgs.filter((c) => JSON.stringify(c).includes('"algorithm":"standard"'));

  assert.ok(intelli.length >= 3);
  assert.ok(standard.length >= 2, 'controls exist for the isolated and four-zone pairs');

  // Every control covers the same zones as some rule build — matched by zone set,
  // not by call index, so adding a scenario cannot silently break the pairing.
  const zonesOf = (c: any) =>
    c.static.options[0].regions.map((r: any) => r.elementSelector.elementCSS).sort().join(',');
  const ruleZones = new Set(intelli.map(zonesOf));
  for (const control of standard) {
    assert.ok(
      ruleZones.has(zonesOf(control)),
      `control over [${zonesOf(control)}] has a matching IntelliIgnore build`,
    );
  }
});

test('intelli-ignore: the sensitivity sweep sends both ends of the knob', async () => {
  const { ctx, runnerCalls } = makeGeneratorContext();
  await generateIntelliIgnore(ctx);

  const sensitivities = configsFrom(runnerCalls)
    .flatMap((c) => c?.static?.options?.[0]?.regions ?? [])
    .map((r: any) => r.configuration?.diffSensitivity)
    .filter((v: unknown) => v !== undefined);

  assert.ok(sensitivities.includes(0), 'sweeps the low end');
  assert.ok(sensitivities.includes(4), 'sweeps the high end');
});

test('intelli-ignore: baselines are shared, not one per scenario', async () => {
  const { ctx, runnerCalls } = makeGeneratorContext();
  await generateIntelliIgnore(ctx);

  // Two baselines: one for the tall all-cases page, one shared by every short-page
  // scenario — not one per scenario.
  const baselines = runnerCalls.filter((c) => !c.env.PERCY_TARGET_BRANCH);
  assert.equal(baselines.length, 3, 'one per page-set (matrix, tall, short) — not one per scenario');

  const baselineBranches = baselines.map((c) => c.env.PERCY_BRANCH);
  const heads = runnerCalls.filter((c) => c.env.PERCY_TARGET_BRANCH);
  for (const h of heads) {
    assert.ok(
      baselineBranches.includes(h.env.PERCY_TARGET_BRANCH),
      `${h.env.PERCY_BRANCH} targets a baseline this run created`,
    );
  }
});
