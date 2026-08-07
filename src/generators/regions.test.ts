import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateRegions } from './regions';
import { makeGeneratorContext } from '../testing/fakes';

test('regions: every rule build is paired with a standard control', async () => {
  const { ctx, runnerCalls } = makeGeneratorContext();
  const builds = await generateRegions(ctx);

  // isolated ignore + its control, the four-zone ignore, layout + its control.
  assert.equal(builds.length, 5);
  assert.ok(builds.every((b) => b.requirement === 'R14'));
  assert.ok(builds.every((b) => b.expectation), 'every build states what QA should see');

  const controls = builds.filter((b) => b.label.startsWith('CONTROL'));
  assert.equal(controls.length, 2, 'a control build per rule — "no diffs" alone proves nothing');

  // The decisive test: exactly one zone changed, and that zone is ignored, so the
  // build should reach zero diffs. Without isolation the count cannot move either way.
  const isolated = builds.find((b) => /ONLY change/.test(b.label));
  assert.ok(isolated, 'an isolated-change ignore build exists');
  assert.match(String(isolated.expectation), /ZERO diffs/);

  assert.ok(runnerCalls.every((c) => c.args.includes('snapshot')));
});

test('regions: rule config reaches the generated percy config', async () => {
  const { ctx, runnerCalls } = makeGeneratorContext();
  await generateRegions(ctx);

  // Every capture passes --config; find the one carrying the ignore rule.
  const configs = runnerCalls.map((c) => {
    const i = c.args.indexOf('--config');
    return i === -1 ? null : JSON.parse(readFileSync(c.args[i + 1], 'utf8'));
  });

  const withIgnore = configs.find((cfg) =>
    JSON.stringify(cfg ?? {}).includes('"algorithm":"ignore"'),
  );
  assert.ok(withIgnore, 'the ignore rule is written into a percy config');

  const regions = (withIgnore as any).static.options[0].regions;
  assert.equal(regions[0].elementSelector.elementCSS, '#promo-carousel');
  assert.equal(regions[0].algorithm, 'ignore');
});
