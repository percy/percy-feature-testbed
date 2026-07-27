/**
 * Profile loader + resolver (plan Unit 2, R2/R2a/R6-token-side/R5-secret-safe).
 *
 * `resolveProfile` is pure (takes a ProfileFile + env) so it is fully unit-testable.
 * `loadProfile` dynamically imports profiles/<name>.js and delegates to it.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveUpstreamPaths } from '../upstream';
import {
  NON_PROD_ALLOWLIST,
  SECRET_KEYS,
  type ProfileFile,
  type ResolvedProfile,
  type ResolvedSecrets,
  type SecretKey,
} from './schema';

export class ProfileError extends Error {}

export interface ResolveOptions {
  env?: NodeJS.ProcessEnv;
  repoRoot?: string;
  /** injected in tests; otherwise derived per run */
  nonceSeed?: string;
  /** required to target an env not on the non-prod allow-list (e.g. preprod) */
  confirmNonAllowlisted?: boolean;
}

function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, '');
}

function defaultNonceSeed(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Validate the allow-list, derive the client API URL, and resolve every declared
 * secret reference from the environment (fail-fast, naming any missing var).
 */
export function resolveProfile(file: ProfileFile, opts: ResolveOptions = {}): ResolvedProfile {
  const env = opts.env ?? process.env;
  const repoRoot = opts.repoRoot ?? process.cwd();

  // Allow-list gate (R2a). Production is never a valid target.
  if (file.env === 'prod') {
    throw new ProfileError('Refusing to target production — this seeder never runs against prod.');
  }
  if (!NON_PROD_ALLOWLIST.includes(file.env) && !opts.confirmNonAllowlisted) {
    throw new ProfileError(
      `Environment "${file.env}" is not on the non-prod allow-list ${JSON.stringify(NON_PROD_ALLOWLIST)}. ` +
        'Pass explicit confirmation to target it (preprod is treated as production-adjacent).',
    );
  }

  // Resolve declared secret refs from env (fail-fast, naming the missing var).
  const secrets: ResolvedSecrets = {};
  for (const [logical, envVar] of Object.entries(file.secrets ?? {})) {
    if (!(SECRET_KEYS as readonly string[]).includes(logical)) {
      throw new ProfileError(`Unknown secret key "${logical}" in profile "${file.env}".`);
    }
    const value = envVar ? env[envVar] : undefined;
    if (!value) {
      throw new ProfileError(
        `Secret "${logical}" references env var ${envVar}, which is unset. ` +
          'Set it in your environment (never inline secrets in the profile file).',
      );
    }
    secrets[logical as SecretKey] = value;
  }

  const appBinaryId = file.appBinaryIdEnv ? env[file.appBinaryIdEnv] : undefined;
  const appPath = file.app?.appPathEnv ? env[file.app.appPathEnv] : undefined;
  const upstream = { ...resolveUpstreamPaths(repoRoot, env), ...(file.upstream ?? {}) };

  return {
    env: file.env,
    baseUrl: file.baseUrl,
    clientApiUrl: `${stripTrailingSlash(file.baseUrl)}/api/v1`,
    disableTls: file.env === 'local',
    secrets,
    appBinaryId,
    runLocalApp: file.app?.runLocal ?? false,
    appPath,
    expectedFlags: file.expectedFlags ?? [],
    upstream,
    nonceSeed: opts.nonceSeed ?? defaultNonceSeed(),
  };
}

/** Dynamically import profiles/<name>.js and resolve it. */
export async function loadProfile(name: string, opts: ResolveOptions = {}): Promise<ResolvedProfile> {
  const repoRoot = opts.repoRoot ?? process.cwd();
  const file = path.join(repoRoot, 'profiles', `${name}.js`);
  let mod: { default?: ProfileFile };
  try {
    mod = (await import(pathToFileURL(file).href)) as { default?: ProfileFile };
  } catch (err) {
    throw new ProfileError(`Could not load profile "${name}" from ${file}: ${(err as Error).message}`);
  }
  if (!mod.default) {
    throw new ProfileError(`Profile "${name}" (${file}) has no default export.`);
  }
  return resolveProfile(mod.default, { ...opts, repoRoot });
}
