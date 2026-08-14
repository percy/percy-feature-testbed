/**
 * Fail-fast precondition gate (plan Unit 8, R2).
 *
 * IMPORTANT: this checks the profile's DECLARED expectations (flags it says are on,
 * creds present) — it cannot read an environment's live LaunchDarkly state. A flag
 * that is actually OFF in the env is only caught by post-build inert-detection.
 */
import type { ResolvedProfile } from './profile/schema';

/** Substrings the renderer/queue routes on by string surgery — must not appear in names. */
export const RESERVED_SUBSTRINGS = ['canary', 'light', 'priority'];

export interface FeatureRequirement {
  feature: string;
  /** flags that must be declared ON in the profile */
  requiredFlags: string[];
  /** needs prod-hub BrowserStack creds + a binary (App Percy) */
  requiresApp?: boolean;
}

export interface PreconditionResult {
  ok: boolean;
  skippedReason?: string;
}

/** Reject names containing a reserved substring (they get silently re-queued). */
export function assertSafeName(name: string): void {
  const bad = RESERVED_SUBSTRINGS.find((s) => name.toLowerCase().includes(s));
  if (bad) {
    throw new Error(
      `name "${name}" contains reserved substring "${bad}" — the renderer re-queues these. Rename it.`,
    );
  }
}

export function checkFeaturePreconditions(
  profile: ResolvedProfile,
  req: FeatureRequirement,
): PreconditionResult {
  const missingFlags = req.requiredFlags.filter((f) => !profile.expectedFlags.includes(f));
  if (missingFlags.length) {
    return { ok: false, skippedReason: `required flag(s) not declared for env: ${missingFlags.join(', ')}` };
  }
  if (req.requiresApp && !profile.runLocalApp) {
    const { browserstackUser, browserstackKey } = profile.secrets;
    if (!browserstackUser || !browserstackKey || !profile.appBinaryId) {
      return { ok: false, skippedReason: 'App Percy needs prod-hub BrowserStack creds + BS_APP_ID (or runLocalApp)' };
    }
  }
  return { ok: true };
}
