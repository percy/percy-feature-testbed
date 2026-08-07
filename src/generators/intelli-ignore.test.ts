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

  // 3 scenarios + 2 sensitivity sweep builds.
  assert.equal(builds.length, 5);
  assert.ok(builds.every((b) => b.requirement === 'R14b'));
  assert.ok(builds.every((b) => b.expectation), 'every build states what QA should see');

  const control = builds.find((b) => b.label.startsWith('CONTROL'));
  assert.ok(control, 'a standard-rule control exists — "no diffs" alone proves nothing');
  assert.match(String(control.expectation), /proof that the fixture really changed/);
});

test('intelli-ignore: the rule and its control run over the same fixture pair', async () => {
  const { ctx, runnerCalls } = makeGeneratorContext();
  await generateIntelliIgnore(ctx);

  const cfgs = configsFrom(runnerCalls);
  const intelli = cfgs.filter((c) => JSON.stringify(c).includes('"algorithm":"intelliignore"'));
  const standard = cfgs.filter((c) => JSON.stringify(c).includes('"algorithm":"standard"'));

  assert.ok(intelli.length >= 3);
  assert.equal(standard.length, 1, 'exactly one control');

  // Same zones under both rules — that is what makes the comparison fair.
  const zonesOf = (c: any) =>
    c.static.options[0].regions.map((r: any) => r.elementSelector.elementCSS).sort();
  assert.deepEqual(zonesOf(standard[0]), zonesOf(intelli[0]));
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

test('intelli-ignore: one approved baseline serves every scenario', async () => {
  const { ctx, runnerCalls } = makeGeneratorContext();
  await generateIntelliIgnore(ctx);

  const baselines = runnerCalls.filter((c) => !c.env.PERCY_TARGET_BRANCH);
  assert.equal(baselines.length, 1, 'no redundant baseline per scenario');

  const heads = runnerCalls.filter((c) => c.env.PERCY_TARGET_BRANCH);
  assert.ok(heads.every((c) => c.env.PERCY_TARGET_BRANCH === baselines[0].env.PERCY_BRANCH));
});
