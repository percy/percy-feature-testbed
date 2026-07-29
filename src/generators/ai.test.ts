import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAI } from './ai';
import { makeGeneratorContext } from '../testing/fakes';

test('ai: baseline + changed via percy upload, returns an R12 build', async () => {
  const { ctx, runnerCalls } = makeGeneratorContext();
  const builds = await generateAI(ctx);
  assert.equal(builds.length, 1);
  assert.equal(builds[0].requirement, 'R12');
  assert.ok(runnerCalls.every((c) => c.args.includes('upload')));
  assert.match(String(runnerCalls[1].env.PERCY_TARGET_BRANCH), /^master-/);
});
