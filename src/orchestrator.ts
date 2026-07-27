/**
 * One-pass, dependency-ordered orchestrator (plan Unit 9, R1/R3/R3b/R7).
 *
 * Runs each feature generator across the account tiers, isolating per-feature
 * failures (one failure skips only that feature, not the pass) and honoring the
 * coarse `--only <feature|tier>` filter. Per-feature preconditions gate before any
 * capture; AI is skipped on the AI-off tier so the contrast is observable.
 *
 * NOTE: this builds ahead of the plan's Phase-0 validation gate (the user chose to
 * write all code now). Unit 0 must still confirm the shared-env credential/token
 * path and the capture wiring before a real run.
 */
import type { CliConfig, FeatureKey, TierKey } from './cli';
import type { ResolvedProfile } from './profile/schema';
import type { ProjectApi } from './percy/project-api';
import type { BuildApi } from './percy/build-api';
import type { Runner } from './exec';
import type { GeneratedBuild, GeneratorContext, SeededProject } from './generators/context';
import { checkFeaturePreconditions } from './preconditions';
import { generateCoreStates } from './generators/web-core';
import { generateVisualGit } from './generators/visual-git';
import { generateRecurringDiff } from './generators/recurring-diff';
import { generateAI } from './generators/ai';
import { generateRegions } from './generators/regions';
import { generateAutoFinalization, generateSupersede, generateAutoApprove } from './generators/approval';
import { generateAppPercy } from './generators/app-percy';

type GenFn = (ctx: GeneratorContext) => Promise<GeneratedBuild[]>;

interface FeatureDef {
  key: FeatureKey;
  run: GenFn;
  requiredFlags: string[];
  requiresApp?: boolean;
  skipTiers?: TierKey[];
}

export const TIERS: readonly TierKey[] = ['free', 'paid', 'ent_global', 'ent_team', 'ai_off'];

export const FEATURES: readonly FeatureDef[] = [
  { key: 'core', run: generateCoreStates, requiredFlags: [] },
  { key: 'visual-git', run: generateVisualGit, requiredFlags: [] },
  { key: 'recurring-diff', run: generateRecurringDiff, requiredFlags: ['recurring_diff'] },
  { key: 'ai', run: generateAI, requiredFlags: ['ai'], skipTiers: ['ai_off'] },
  {
    key: 'approval',
    run: async (ctx) => [
      ...(await generateAutoFinalization(ctx)),
      ...(await generateSupersede(ctx)),
      ...(await generateAutoApprove(ctx)),
    ],
    requiredFlags: ['auto_approve', 'squash_builds'],
  },
  { key: 'regions', run: generateRegions, requiredFlags: [] },
  { key: 'app-percy', run: generateAppPercy, requiredFlags: [], requiresApp: true },
];

export interface SkippedFeature {
  tier: TierKey;
  feature: FeatureKey;
  reason: string;
}

export type OrchestratedBuild = GeneratedBuild & { tier: TierKey; projectSlug: string };

export interface RunResult {
  builds: OrchestratedBuild[];
  skipped: SkippedFeature[];
}

export interface OrchestratorDeps {
  profile: ResolvedProfile;
  projectApi: ProjectApi;
  buildApi: BuildApi;
  runner: Runner;
  /** create/seed a project for a tier and return its SeededProject (write + read tokens) */
  provisionProject: (tier: TierKey) => Promise<SeededProject>;
  nonce: string;
}

export function selectTiers(only?: CliConfig['only']): TierKey[] {
  if (only && (TIERS as readonly string[]).includes(only)) return [only as TierKey];
  return [...TIERS];
}

export function selectFeatures(only?: CliConfig['only']): FeatureDef[] {
  if (only && FEATURES.some((f) => f.key === only)) return FEATURES.filter((f) => f.key === only);
  return [...FEATURES];
}

export async function orchestrate(config: CliConfig, deps: OrchestratorDeps): Promise<RunResult> {
  const result: RunResult = { builds: [], skipped: [] };
  const tiers = selectTiers(config.only);
  const features = selectFeatures(config.only);

  for (const tier of tiers) {
    let project: SeededProject;
    try {
      project = await deps.provisionProject(tier);
    } catch (err) {
      for (const f of features) {
        result.skipped.push({ tier, feature: f.key, reason: `provisioning failed: ${(err as Error).message}` });
      }
      continue;
    }

    const ctx: GeneratorContext = {
      profile: deps.profile,
      project,
      projectApi: deps.projectApi,
      buildApi: deps.buildApi,
      runner: deps.runner,
      nonce: deps.nonce,
    };

    for (const f of features) {
      if (f.skipTiers?.includes(tier)) {
        result.skipped.push({ tier, feature: f.key, reason: `not applicable on tier "${tier}"` });
        continue;
      }
      const pre = checkFeaturePreconditions(deps.profile, {
        feature: f.key,
        requiredFlags: f.requiredFlags,
        requiresApp: f.requiresApp,
      });
      if (!pre.ok) {
        result.skipped.push({ tier, feature: f.key, reason: pre.skippedReason ?? 'precondition failed' });
        continue;
      }
      try {
        const builds = await f.run(ctx);
        for (const b of builds) result.builds.push({ ...b, tier, projectSlug: project.slug });
      } catch (err) {
        // Isolate: one feature failing does not abort the pass.
        result.skipped.push({ tier, feature: f.key, reason: `error: ${(err as Error).message}` });
      }
    }
  }

  return result;
}
