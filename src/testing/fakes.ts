/**
 * Shared test doubles: a fake HttpClient recorder and a profile factory. Reused
 * across the Percy REST + generator + orchestrator tests so nothing hits the network.
 */
import type { HttpClient, HttpRequest, HttpResponse } from '../http';
import type { ResolvedProfile } from '../profile/schema';

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
