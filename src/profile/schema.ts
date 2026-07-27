/**
 * Profile types + the non-prod allow-list (plan Unit 2, R2/R2a).
 *
 * A profile FILE (profiles/<env>.js) holds only non-secret config plus the NAMES
 * of the env vars that carry each secret. Resolution reads those env vars at
 * runtime into a ResolvedProfile. Secrets are never inlined in files.
 */
import type { UpstreamPaths } from '../upstream';

export type EnvName = 'local' | 'staging' | 'canary' | 'preprod' | 'prod';

/** Environments the seeder may target without extra confirmation. Prod is never allowed. */
export const NON_PROD_ALLOWLIST: readonly EnvName[] = ['local', 'staging', 'canary'];

/** Logical secret keys a profile may declare (each maps to an env-var NAME in the file). */
export const SECRET_KEYS = [
  'userToken', // user-level principal — mutations/approval/regions/AI
  'sessionCookie', // alternative user auth (with xsrfToken)
  'xsrfToken',
  'browserstackUser', // App Percy (prod hub)
  'browserstackKey',
] as const;

export type SecretKey = (typeof SECRET_KEYS)[number];

/** Raw shape of a profile file's default export. */
export interface ProfileFile {
  env: EnvName;
  baseUrl: string;
  /** logical secret name -> NAME of the env var carrying its value */
  secrets?: Partial<Record<SecretKey, string>>;
  /** env var carrying bs://<hash> for the App Percy binary */
  appBinaryIdEnv?: string;
  expectedFlags?: string[];
  app?: { runLocal?: boolean; appPathEnv?: string };
  upstream?: Partial<UpstreamPaths>;
}

export type ResolvedSecrets = Partial<Record<SecretKey, string>>;

export interface ResolvedProfile {
  env: EnvName;
  baseUrl: string;
  /** always `${baseUrl}/api/v1` — injected on every capture so builds don't land on prod */
  clientApiUrl: string;
  /** local mkcert dev cert only — NEVER true for a shared/remote env (would enable MITM) */
  disableTls: boolean;
  secrets: ResolvedSecrets;
  appBinaryId?: string;
  runLocalApp: boolean;
  appPath?: string;
  expectedFlags: string[];
  upstream: UpstreamPaths;
  /** per-run nonce seed; injected in tests for reproducibility */
  nonceSeed: string;
}
