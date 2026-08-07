/**
 * Fixture sets — which pages exist in a build, and which variant each renders.
 *
 * `percy snapshot <dir>` turns one file into one snapshot, so adding/removing a file
 * is what produces NEW / REMOVED review states, and changing a page's variant is what
 * produces CHANGED. Filenames are stable across sets so snapshots line up build to build.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { renderStorefront, renderPricing, renderAbout, type PageVariant } from './pages';

/**
 * The review-state sets (`baseline`…`removed`) mirror the old image path, so the core
 * generators keep working. The rest exist for the region rules.
 */
export type FixtureKind =
  | 'baseline'
  | 'unchanged'
  | 'changed'
  | 'new'
  | 'removed'
  | 'noise'
  | 'noise-signal'
  | 'layout-shift';

/** Snapshot names, derived from these filenames by the Percy static server. */
export const HOME = 'home.html';
export const PRICING = 'pricing.html';
export const ABOUT = 'about.html';

const STOREFRONT_VARIANT: Record<FixtureKind, PageVariant> = {
  baseline: 'baseline',
  unchanged: 'baseline',
  changed: 'signal',
  new: 'baseline',
  removed: 'baseline',
  noise: 'noise',
  'noise-signal': 'noise-signal',
  'layout-shift': 'layout-shift',
};

/** Which files a set contains. `new` gains a page; `removed` drops one. */
function filesFor(kind: FixtureKind): string[] {
  if (kind === 'new') return [HOME, PRICING, ABOUT];
  if (kind === 'removed') return [HOME];
  return [HOME, PRICING];
}

/**
 * Render a set into `dir`, creating it if needed. Returns the written paths.
 * `nonce` is stamped identically on every page of a run so re-runs produce unique
 * pixels without registering as a diff within the run.
 */
export function writeFixtureSet(dir: string, kind: FixtureKind, nonce = ''): string[] {
  mkdirSync(dir, { recursive: true });
  const variant = STOREFRONT_VARIANT[kind];
  const written: string[] = [];

  for (const file of filesFor(kind)) {
    const html =
      file === HOME ? renderStorefront(variant, nonce)
        : file === PRICING ? renderPricing(nonce)
          : renderAbout(nonce);
    const path = join(dir, file);
    writeFileSync(path, html);
    written.push(path);
  }
  return written;
}
