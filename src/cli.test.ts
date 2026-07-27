import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCliArgs,
  run,
  UsageError,
  FEATURE_KEYS,
  TIER_KEYS,
} from './cli';

// Happy path: profile with no --only means a full pass.
test('parses --profile with no --only as a full pass', () => {
  const cfg = parseCliArgs(['--profile', 'canary']);
  assert.deepEqual(cfg, { profile: 'canary', only: undefined });
});

// Verification: routes to dispatch without running a real pass.
test('run() routes to the injected dispatch and returns the config', async () => {
  let received: unknown;
  const cfg = await run(['--profile', 'canary', '--only', 'regions'], {
    dispatch: (c) => {
      received = c;
    },
  });
  assert.deepEqual(cfg, { profile: 'canary', only: 'regions' });
  assert.deepEqual(received, cfg);
});

// Edge case: missing --profile.
test('missing --profile throws UsageError', () => {
  assert.throws(() => parseCliArgs([]), UsageError);
});

// Edge case: unknown --only must list the valid keys.
test('unknown --only throws UsageError listing valid feature and tier keys', () => {
  try {
    parseCliArgs(['--profile', 'canary', '--only', 'bogus']);
    assert.fail('expected UsageError');
  } catch (err) {
    assert.ok(err instanceof UsageError);
    for (const key of [...FEATURE_KEYS, ...TIER_KEYS]) {
      assert.ok(
        (err as Error).message.includes(key),
        `error message should list valid key "${key}"`,
      );
    }
  }
});

// Edge case: unknown flags are rejected (strict parsing).
test('unknown flags are rejected', () => {
  assert.throws(() => parseCliArgs(['--profile', 'canary', '--wat']), UsageError);
});

// A valid feature key and a valid tier key are both accepted for --only.
test('accepts a valid feature key and a valid tier key for --only', () => {
  assert.equal(parseCliArgs(['--profile', 'canary', '--only', 'regions']).only, 'regions');
  assert.equal(parseCliArgs(['--profile', 'canary', '--only', 'paid']).only, 'paid');
});
