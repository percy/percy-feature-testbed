import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateVisualGit } from './visual-git';
import { makeGeneratorContext } from '../testing/fakes';

test('visual-git: variant-A baseline then variant-B head with PERCY_TARGET_BRANCH', async () => {
  const { ctx, runnerCalls } = makeGeneratorContext({ nonce: 'n1' });
  const builds = await generateVisualGit(ctx);
  assert.equal(builds.length, 2);
  assert.equal(builds[0].requirement, 'R9');
  assert.equal(builds[1].requirement, 'R10');
  assert.match(String(runnerCalls[0].env.PERCY_BRANCH), /^variant-a-n1$/);
  assert.match(String(runnerCalls[1].env.PERCY_TARGET_BRANCH), /^variant-a-n1$/);
});
