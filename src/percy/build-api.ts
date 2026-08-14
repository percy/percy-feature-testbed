/**
 * Build REST API + poll-to-completion (plan Unit 3, R3b/R13).
 *
 * - createBuild/finalizeBuild use the project WRITE token.
 * - getBuildState/waitForBuildFinished poll with a READ token (a write_only
 *   token cannot read builds — the server returns 401, surfaced here).
 * - reviewBuild (approve baseline etc.) uses BrowserStack Basic auth; the user
 *   must carry BUILDS_APPROVE.
 */
import type { HttpClient } from '../http';
import type { ResolvedProfile } from '../profile/schema';
import { basicAuthHeaders, projectTokenHeaders } from './auth';

export interface BuildState {
  state?: string; // pending | processing | finished | failed | ...
  reviewState?: string;
  totalComparisons?: number;
  totalComparisonsFinished?: number;
}

export type ReviewAction = 'approve' | 'reject' | 'unapprove';

export interface WaitOptions {
  timeoutMs?: number;
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const FINISHED = 'finished';
const FAILED_STATES = new Set(['failed', 'errored', 'expired']);

export interface BuildApi {
  createBuild(writeToken: string, branch: string): Promise<string>;
  finalizeBuild(buildId: string, writeToken: string): Promise<void>;
  reviewBuild(buildId: string, action: ReviewAction): Promise<void>;
  getBuildState(buildId: string, readToken: string): Promise<BuildState>;
  waitForBuildFinished(buildId: string, readToken: string, opts?: WaitOptions): Promise<BuildState>;
}

export function createBuildApi(profile: ResolvedProfile, http: HttpClient): BuildApi {
  const api = profile.clientApiUrl;

  function reviewAuth(): Record<string, string> {
    const { browserstackUser, browserstackKey } = profile.secrets;
    if (!browserstackUser || !browserstackKey) {
      throw new Error(
        'reviewBuild needs BrowserStack Basic-auth creds (browserstackUser/browserstackKey) with BUILDS_APPROVE.',
      );
    }
    return basicAuthHeaders(browserstackUser, browserstackKey);
  }

  const buildApi: BuildApi = {
    async createBuild(writeToken, branch) {
      const res = await http({
        method: 'POST',
        url: `${api}/builds`,
        headers: projectTokenHeaders(writeToken),
        contentType: 'application/vnd.api+json',
        body: { data: { type: 'builds', attributes: { branch } } },
      });
      if (!res.ok) throw new Error(`createBuild failed (${res.status}): ${res.text}`);
      return String((res.body as any)?.data?.id);
    },

    async finalizeBuild(buildId, writeToken) {
      const res = await http({
        method: 'POST',
        url: `${api}/builds/${buildId}/finalize`,
        headers: projectTokenHeaders(writeToken),
      });
      if (!res.ok) throw new Error(`finalizeBuild failed (${res.status}): ${res.text}`);
    },

    async reviewBuild(buildId, action) {
      const res = await http({
        method: 'POST',
        url: `${api}/reviews`,
        headers: reviewAuth(),
        body: {
          data: {
            type: 'reviews',
            attributes: { action },
            relationships: { build: { data: { type: 'builds', id: buildId } } },
          },
        },
      });
      // 409 = the action is already applied. On orgs where the default branch
      // auto-approves, every baseline comes back 409 — treating that as a failure
      // would break every generator that approves a baseline.
      if (res.status === 409) return;
      if (!res.ok) throw new Error(`reviewBuild(${action}) failed (${res.status}): ${res.text}`);
    },

    async getBuildState(buildId, readToken) {
      const res = await http({
        method: 'GET',
        url: `${api}/builds/${buildId}`,
        headers: projectTokenHeaders(readToken),
      });
      if (!res.ok) throw new Error(`getBuildState failed (${res.status}): ${res.text}`);
      const a = (res.body as any)?.data?.attributes ?? {};
      return {
        state: a['state'],
        reviewState: a['review-state'],
        totalComparisons: a['total-comparisons'],
        totalComparisonsFinished: a['total-comparisons-finished'],
      };
    },

    async waitForBuildFinished(buildId, readToken, opts = {}) {
      // 15 minutes. The old 300s default was too short for the >10,000px fixtures:
      // a 4-page tall build measured 396s of Percy processing and aborted a live run
      // after the builds had already been paid for.
      const timeoutMs = opts.timeoutMs ?? 900_000;
      const intervalMs = opts.intervalMs ?? 2_000;
      const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
      const now = opts.now ?? (() => Date.now());
      const start = now();
      let lastError: unknown;

      for (;;) {
        // A single 502/429/socket hiccup mid-poll used to abort the whole feature.
        // Transient failures are retried within the timeout budget; only a terminal
        // build state fails fast.
        let st: BuildState | undefined;
        try {
          st = await buildApi.getBuildState(buildId, readToken);
          lastError = undefined;
        } catch (err) {
          lastError = err;
        }

        if (st) {
          if (st.state === FINISHED) return st;
          if (st.state && FAILED_STATES.has(st.state)) {
            throw new Error(`build ${buildId} reached terminal state "${st.state}" before finishing`);
          }
        }

        if (now() - start >= timeoutMs) {
          const detail = lastError
            ? `last error: ${(lastError as Error).message}`
            : `last state: ${st?.state ?? 'unknown'}`;
          throw new Error(`timed out after ${timeoutMs}ms waiting for build ${buildId} (${detail})`);
        }
        await sleep(intervalMs);
      }
    },
  };

  return buildApi;
}
