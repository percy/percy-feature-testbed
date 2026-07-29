import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRegions } from './regions';
import { makeGeneratorContext } from '../testing/fakes';

test('regions: baseline + changed via percy upload, returns an R14 build', async () => {
  const { ctx, runnerCalls } = makeGeneratorContext();
  const builds = await generateRegions(ctx);
  assert.equal(builds.length, 1);
  assert.equal(builds[0].requirement, 'R14');
  assert.ok(runnerCalls.every((c) => c.args.includes('upload')));
});
