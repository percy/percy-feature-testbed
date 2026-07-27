/**
 * Shared test doubles: a fake HttpClient recorder and a profile factory. Reused
 * across the Percy REST + generator + orchestrator tests so nothing hits the network.
 */
import type { HttpClient, HttpRequest, HttpResponse } from '../http';
import type { ResolvedProfile } from '../profile/schema';
import type { ExecResult, Runner } from '../exec';
import type { GeneratorContext, SeededProject } from '../generators/context';
import { createBuildApi } from '../percy/build-api';
import { createProjectApi } from '../percy/project-api';

export function makeProfile(overrides: Partial<ResolvedProfile> = {}): ResolvedProfile {
  return {
    env: 'canary',
    baseUrl: 'https://canary.percy.io',
    clientApiUrl: 'https://canary.percy.io/api/v1',
    disableTls: false,
    secrets: { userToken: 'user-tok', browserstackUser: 'bsuser', browserstackKey: 'bskey' },
    appBinaryId: 'bs://app-hash',
    runLocalApp: false,
    expectedFlags: [],
    upstream: { seedAccounts: '/up/seed', percyPlaywright: '/up/pw' },
    nonceSeed: 'seed',
    ...overrides,
  };
}

export function okJson(body: unknown, status = 200): HttpResponse {
  return { status, ok: status >= 200 && status < 300, body, text: JSON.stringify(body) };
}

export function errStatus(status: number, text = ''): HttpResponse {
  return { status, ok: false, body: undefined, text };
}

export interface Recorder {
  http: HttpClient;
  calls: HttpRequest[];
}

/**
 * A fake HttpClient that records requests. Provide either an array of responses
 * (the last repeats once exhausted) or a function computing a response per call.
 */
export function recorder(
  responses: HttpResponse[] | ((req: HttpRequest, index: number) => HttpResponse),
): Recorder {
  const calls: HttpRequest[] = [];
  let i = 0;
  const http: HttpClient = async (req) => {
    calls.push(req);
    if (typeof responses === 'function') return responses(req, i++);
    const r = responses[Math.min(i, responses.length - 1)] ?? okJson({});
    i++;
    return r;
  };
  return { http, calls };
}

export const FAKE_PROJECT: SeededProject = {
  id: 'p1',
  slug: 'seed-paid-web',
  teamId: 'team-1',
  writeToken: 'write-tok',
  readToken: 'read-tok',
};

export interface RunnerCall {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

/** A Runner that finalizes a distinct build id per call and records the invocations. */
export function finalizingRunner(): { runner: Runner; calls: RunnerCall[] } {
  const calls: RunnerCall[] = [];
  let n = 900;
  const runner: Runner = async (command, args, opts) => {
    calls.push({ command, args, env: opts?.env ?? {} });
    const id = ++n;
    const res: ExecResult = {
      stdout: `Finalized build #${id}: https://canary.percy.io/o/p/builds/${id}`,
      stderr: '',
      code: 0,
    };
    return res;
  };
  return { runner, calls };
}

/**
 * A GeneratorContext wired to a finalizing runner and a build API whose GETs report
 * `finished`. Exposes the runner calls (for env/branch assertions) and http calls
 * (for PATCH/review assertions).
 */
export function makeGeneratorContext(
  opts: { reviewState?: string; nonce?: string } = {},
): { ctx: GeneratorContext; runnerCalls: RunnerCall[]; httpCalls: HttpRequest[] } {
  const { runner, calls: runnerCalls } = finalizingRunner();
  const rec = recorder((req) =>
    req.method === 'GET'
      ? okJson({ data: { attributes: { state: 'finished', 'review-state': opts.reviewState ?? 'unreviewed' } } })
      : okJson({}),
  );
  const profile = makeProfile();
  const ctx: GeneratorContext = {
    profile,
    project: FAKE_PROJECT,
    projectApi: createProjectApi(profile, rec.http),
    buildApi: createBuildApi(profile, rec.http),
    runner,
    nonce: opts.nonce ?? 'n1',
  };
  return { ctx, runnerCalls, httpCalls: rec.calls };
}
