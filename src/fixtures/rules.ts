/**
 * Region-rule config for a capture.
 *
 * Percy accepts all four rules declaratively per snapshot — no SDK, no browser driver:
 *   regions[].algorithm: standard | layout | ignore | intelliignore
 *   regions[].configuration: diffSensitivity 0-4, imageIgnoreThreshold 0-1,
 *                            carouselsEnabled, bannersEnabled, adsEnabled
 * We write these into a generated Percy config consumed via `percy snapshot --config`.
 */
import { ZONES, type ZoneKey } from './pages';
import { HOME } from './sets';

/** The fixtures are authored at this width; snapshots are pinned to it. */
export const FIXTURE_WIDTH = 1280;

export type RegionAlgorithm = 'standard' | 'layout' | 'ignore' | 'intelliignore';

export interface RuleConfiguration {
  diffSensitivity?: number; // 0-4
  imageIgnoreThreshold?: number; // 0-1
  carouselsEnabled?: boolean;
  bannersEnabled?: boolean;
  adsEnabled?: boolean;
}

export interface RegionRule {
  /** zones this rule applies to, by fixture zone key */
  zones: ZoneKey[];
  algorithm: RegionAlgorithm;
  configuration?: RuleConfiguration;
}

/** The noise zones IntelliIgnore is meant to suppress. */
export const NOISE_ZONES: ZoneKey[] = ['carousel', 'ad', 'banner', 'timestamp'];

/** Turn on exactly the noise classes IntelliIgnore knows about. */
export const INTELLI_NOISE_CONFIG: RuleConfiguration = {
  carouselsEnabled: true,
  bannersEnabled: true,
  adsEnabled: true,
};

interface PercyRegion {
  elementSelector: { elementCSS: string };
  algorithm: RegionAlgorithm;
  configuration?: RuleConfiguration;
}

/**
 * Build the Percy config object for a capture. Rules are scoped to the storefront
 * page — the only page carrying the zones — so the other snapshots stay plain
 * comparisons and act as a sanity check that the build itself worked.
 */
export function buildPercyConfig(rules: RegionRule[]): Record<string, unknown> {
  const regions: PercyRegion[] = [];
  for (const rule of rules) {
    for (const zone of rule.zones) {
      regions.push({
        elementSelector: { elementCSS: ZONES[zone] },
        algorithm: rule.algorithm,
        ...(rule.configuration ? { configuration: rule.configuration } : {}),
      });
    }
  }

  // Pin the width. The fixtures are a fixed 1280px layout, so at Percy's default
  // 375px the price table and sidebar fall outside the rendered area and a real
  // change registers no diff — half the signal silently disappears. One width also
  // keeps region selectors mapping to exactly what QA sees.
  const config: Record<string, unknown> = { version: 2, snapshot: { widths: [FIXTURE_WIDTH] } };
  if (regions.length) {
    config.static = { options: [{ include: `/${HOME}`, regions }] };
  }
  return config;
}
