import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCoreStates } from './web-core';
import { makeGeneratorContext } from '../testing/fakes';

test('core states: approved baseline then changed via percy upload (client-api-url + nonce)', async () => {
  const { ctx, runnerCalls } = makeGeneratorContext({ nonce: 'n123' });
  const builds = await generateCoreStates(ctx);

  assert.equal(builds.length, 2);
  assert.ok(builds.every((b) => b.requirement === 'R8'));

  // Both captures ran `percy upload`, injected PERCY_CLIENT_API_URL, and nonced the branch.
  for (const c of runnerCalls) {
    assert.ok(c.args.includes('upload'), 'uses percy upload');
    assert.equal(c.env.PERCY_CLIENT_API_URL, 'https://canary.percy.io/api/v1');
    assert.match(String(c.env.PERCY_BRANCH), /-n123$/);
  }
  // The changed build targets the baseline branch.
  assert.match(String(runnerCalls[1].env.PERCY_TARGET_BRANCH), /^master-n123$/);
});
