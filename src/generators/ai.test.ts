import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAI } from './ai';
import { makeGeneratorContext } from '../testing/fakes';

test('ai: uses the AI fixture YAML pair and returns an R12 build', async () => {
  const { ctx, runnerCalls } = makeGeneratorContext();
  const builds = await generateAI(ctx);
  assert.equal(builds.length, 1);
  assert.equal(builds[0].requirement, 'R12');
  assert.ok(runnerCalls[0].args.join(' ').includes('ai_details_baseline.yml'));
  assert.ok(runnerCalls[1].args.join(' ').includes('ai_details_diff.yml'));
});
