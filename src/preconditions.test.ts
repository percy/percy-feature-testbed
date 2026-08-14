import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeName, checkFeaturePreconditions } from './preconditions';
import { makeProfile } from './testing/fakes';

test('assertSafeName rejects reserved substrings (canary/light/priority)', () => {
  assert.throws(() => assertSafeName('canary-seed'), /reserved substring/);
  assert.throws(() => assertSafeName('priority-web'), /reserved/);
  assert.doesNotThrow(() => assertSafeName('seed-paid-web'));
});

test('precondition skips when a required flag is not declared for the env', () => {
  const r = checkFeaturePreconditions(makeProfile({ expectedFlags: [] }), {
    feature: 'ai',
    requiredFlags: ['ai'],
  });
  assert.equal(r.ok, false);
  assert.match(r.skippedReason!, /ai/);
});

test('precondition skips app features when creds/binary are missing', () => {
  const r = checkFeaturePreconditions(makeProfile({ secrets: { userToken: 'u' }, appBinaryId: undefined }), {
    feature: 'app-percy',
    requiredFlags: [],
    requiresApp: true,
  });
  assert.equal(r.ok, false);
});

test('precondition passes when flags declared and app creds present', () => {
  const p = makeProfile({ expectedFlags: ['ai'] });
  assert.equal(checkFeaturePreconditions(p, { feature: 'ai', requiredFlags: ['ai'] }).ok, true);
  assert.equal(
    checkFeaturePreconditions(p, { feature: 'app-percy', requiredFlags: [], requiresApp: true }).ok,
    true,
  );
});
