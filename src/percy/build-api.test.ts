import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBuildApi } from './build-api';
import { makeProfile, recorder, okJson, errStatus } from '../testing/fakes';

test('createBuild POSTs vnd.api+json with the write token', async () => {
  const { http, calls } = recorder([okJson({ data: { id: '900' } })]);
  const id = await createBuildApi(makeProfile(), http).createBuild('write-tok', 'feature/x');
  assert.equal(id, '900');
  assert.equal(calls[0].url, 'https://canary.percy.io/api/v1/builds');
  assert.equal(calls[0].contentType, 'application/vnd.api+json');
  assert.equal(calls[0].headers?.authorization, 'Token token=write-tok');
  assert.equal((calls[0].body as any).data.attributes.branch, 'feature/x');
});

test('reviewBuild uses Basic auth against /reviews with the build relationship', async () => {
  const { http, calls } = recorder([okJson({})]);
  await createBuildApi(makeProfile(), http).reviewBuild('900', 'approve');
  assert.equal(calls[0].url, 'https://canary.percy.io/api/v1/reviews');
  assert.match(calls[0].headers?.authorization ?? '', /^Basic /);
  assert.equal((calls[0].body as any).data.attributes.action, 'approve');
  assert.equal((calls[0].body as any).data.relationships.build.data.id, '900');
});

test('reviewBuild tolerates 409 — an auto-approved baseline is not a failure', async () => {
  // Orgs whose default branch auto-approves answer 409 "already performed" for every
  // baseline. Throwing there would break every generator that approves one.
  const { http } = recorder([errStatus(409, 'approve action is already performed on this build')]);
  await createBuildApi(makeProfile(), http).reviewBuild('900', 'approve');
});

test('reviewBuild still throws on a real failure', async () => {
  const { http } = recorder([errStatus(403, 'forbidden')]);
  await assert.rejects(
    () => createBuildApi(makeProfile(), http).reviewBuild('900', 'approve'),
    /403/,
  );
});

test('reviewBuild without BrowserStack creds throws', async () => {
  const { http } = recorder([okJson({})]);
  const api = createBuildApi(makeProfile({ secrets: { userToken: 'u' } }), http);
  await assert.rejects(() => api.reviewBuild('900', 'approve'), /BUILDS_APPROVE|Basic-auth/);
});

test('waitForBuildFinished polls until finished (injected sleep/now, no real wait)', async () => {
  const states = ['pending', 'processing', 'finished'];
  let n = 0;
  const { http } = recorder(() => okJson({ data: { attributes: { state: states[Math.min(n++, 2)] } } }));
  const st = await createBuildApi(makeProfile(), http).waitForBuildFinished('900', 'read-tok', {
    sleep: async () => {},
    now: () => 0,
  });
  assert.equal(st.state, 'finished');
  assert.equal(n, 3);
});

test('waitForBuildFinished bails on a terminal failure state', async () => {
  const { http } = recorder(() => okJson({ data: { attributes: { state: 'failed' } } }));
  await assert.rejects(
    () =>
      createBuildApi(makeProfile(), http).waitForBuildFinished('900', 'read-tok', {
        sleep: async () => {},
        now: () => 0,
      }),
    /terminal state "failed"/,
  );
});

test('getBuildState surfaces an auth failure (write_only cannot read builds)', async () => {
  const { http } = recorder([errStatus(401, 'Unauthorized')]);
  await assert.rejects(
    () => createBuildApi(makeProfile(), http).getBuildState('900', 'write-only-tok'),
    /getBuildState failed \(401\)/,
  );
});
