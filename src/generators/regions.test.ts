import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRegions } from './regions';
import { makeGeneratorContext } from '../testing/fakes';

test('regions: baseline then diff using the regions fixture pair (R14)', async () => {
  const { ctx, runnerCalls } = makeGeneratorContext();
  const builds = await generateRegions(ctx);
  assert.equal(builds.length, 1);
  assert.equal(builds[0].requirement, 'R14');
  assert.ok(runnerCalls[0].args.join(' ').includes('regions_baseline.yml'));
  assert.ok(runnerCalls[1].args.join(' ').includes('regions_diff.yml'));
});
