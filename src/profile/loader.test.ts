import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProfile, ProfileError } from './loader';
import type { ProfileFile } from './schema';

const REPO = '/home/dev/percy/percy-feature-testbed';
const base: ProfileFile = {
  env: 'canary',
  baseUrl: 'https://canary.percy.io',
  secrets: { userToken: 'UT' },
  expectedFlags: ['ai'],
};

test('resolves a canary profile: clientApiUrl, secrets, upstream siblings', () => {
  const p = resolveProfile(base, { repoRoot: REPO, nonceSeed: 'seed123', env: { UT: 'tok-abcd' } });
  assert.equal(p.clientApiUrl, 'https://canary.percy.io/api/v1');
  assert.equal(p.secrets.userToken, 'tok-abcd');
  assert.equal(p.disableTls, false);
  assert.equal(p.nonceSeed, 'seed123');
  assert.ok(p.upstream.seedAccounts.endsWith('percy-api-seed-accounts'));
});

test('refuses production always (even with confirmation)', () => {
  assert.throws(
    () => resolveProfile({ ...base, env: 'prod', secrets: {} }, { repoRoot: REPO, env: {}, confirmNonAllowlisted: true }),
    ProfileError,
  );
});

test('preprod requires explicit confirmation', () => {
  const pp: ProfileFile = { ...base, env: 'preprod', secrets: {} };
  assert.throws(() => resolveProfile(pp, { repoRoot: REPO, env: {} }), ProfileError);
  const ok = resolveProfile(pp, { repoRoot: REPO, env: {}, confirmNonAllowlisted: true });
  assert.equal(ok.env, 'preprod');
});

test('missing declared secret env var fails fast, naming the var', () => {
  try {
    resolveProfile(base, { repoRoot: REPO, env: {} }); // UT unset
    assert.fail('expected ProfileError');
  } catch (err) {
    assert.ok(err instanceof ProfileError);
    assert.ok((err as Error).message.includes('UT'), 'message should name the missing env var');
  }
});

test('normalizes a trailing slash in baseUrl (no //api/v1)', () => {
  const p = resolveProfile(
    { ...base, baseUrl: 'https://canary.percy.io/' },
    { repoRoot: REPO, env: { UT: 'x' } },
  );
  assert.equal(p.clientApiUrl, 'https://canary.percy.io/api/v1');
});

test('local env sets disableTls true (dev cert)', () => {
  const p = resolveProfile({ ...base, env: 'local', secrets: {} }, { repoRoot: REPO, env: {} });
  assert.equal(p.disableTls, true);
});

test('rejects an unknown secret key', () => {
  const bad = { ...base, secrets: { bogus: 'X' } } as unknown as ProfileFile;
  assert.throws(() => resolveProfile(bad, { repoRoot: REPO, env: { X: 'y' } }), ProfileError);
});
