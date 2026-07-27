import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveUpstreamPaths, UPSTREAM_ENV_OVERRIDES } from './upstream';

test('defaults resolve upstreams as siblings under the hub', () => {
  const repoRoot = '/home/dev/percy/percy-feature-testbed';
  const paths = resolveUpstreamPaths(repoRoot, {});
  assert.equal(paths.seedAccounts, path.normalize('/home/dev/percy/percy-api-seed-accounts'));
  assert.equal(
    paths.percyPlaywright,
    path.normalize('/home/dev/percy/BStackAutomation-vra/percy/percy_playwright'),
  );
});

test('env overrides take precedence over the sibling defaults', () => {
  const paths = resolveUpstreamPaths('/home/dev/percy/percy-feature-testbed', {
    [UPSTREAM_ENV_OVERRIDES.seedAccounts]: '/custom/seed',
    [UPSTREAM_ENV_OVERRIDES.percyPlaywright]: '/custom/pw',
  });
  assert.equal(paths.seedAccounts, '/custom/seed');
  assert.equal(paths.percyPlaywright, '/custom/pw');
});
