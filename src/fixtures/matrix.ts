/**
 * The falsifiable IntelliIgnore test: one case per PAGE.
 *
 * Build-level `total-comparisons-diff` counts comparisons (snapshot × browser), so
 * putting every case in one snapshot makes the number binary — it reads the same
 * whether a rule fired or not. Splitting the cases across pages turns it back into
 * arithmetic: each page contributes 0 or BROWSERS_PER_SNAPSHOT, and the total says
 * exactly which pages diffed.
 *
 * Each page is also >10,000px tall (review feedback on PER-10456): a big DOM per page,
 * so the build is inspectable, while one case per page keeps the count attributable.
 * The filler is byte-identical between the baseline and changed variants, so only the
 * case zone can contribute a diff.
 *
 * Four pages, each changing by the same amount, differing only in the rule applied:
 *
 *   a-noise-intelli   carousel slide changes, `intelliignore` on it  -> expect 0
 *   b-noise-standard  carousel slide changes, `standard` on it       -> expect 4
 *   c-signal          price changes, no rule                         -> expect 4
 *   d-unchanged       nothing changes                                -> expect 0
 *
 * Working IntelliIgnore totals 8. A no-op totals 12. Those are different numbers, so
 * the test can fail — which is the whole point.
 */
import { ZONES } from './pages';

export const MATRIX_PAGES = {
  noiseIntelli: 'a-noise-intelli.html',
  noiseStandard: 'b-noise-standard.html',
  signal: 'c-signal.html',
  unchanged: 'd-unchanged.html',
} as const;

const FILLER_SECTION_HEIGHT = 1400;
const FILLER_SECTIONS = 8;

/** Nominal page height, asserted in tests so the >10,000px target cannot regress. */
export const MATRIX_PAGE_MIN_HEIGHT = FILLER_SECTIONS * FILLER_SECTION_HEIGHT;

/** Percy runs one comparison per browser at the pinned width. */
export const BROWSERS_PER_SNAPSHOT = 4;

/** Diffing pages if IntelliIgnore suppresses (b + c); if it does not, a also diffs. */
export const EXPECTED_DIFF_WORKING = 2 * BROWSERS_PER_SNAPSHOT;
export const EXPECTED_DIFF_NOOP = 3 * BROWSERS_PER_SNAPSHOT;

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #f6f8fa; font-family: -apple-system, "Segoe UI", Arial, sans-serif; color: #14212b; }
  .page { width: 1280px; margin: 0 auto; padding: 48px; }
  .tag { font-size: 12px; letter-spacing: 1.4px; color: #93a1b0; margin-bottom: 12px; }
  .carousel { border-radius: 12px; padding: 40px; color: #fff; background: #3b5bdb; }
  .carousel h3 { font-size: 30px; margin-bottom: 8px; }
  .dots { margin-top: 20px; display: flex; gap: 8px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: rgba(255,255,255,.45); }
  .dot.on { background: #fff; }
  .panel { background: #fff; border: 1px solid #e2e8ef; border-radius: 12px; padding: 28px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 13px 10px; font-size: 16px; border-bottom: 1px solid #eef2f6; }
  th { color: #6b7a89; font-size: 13px; text-transform: uppercase; letter-spacing: .4px; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .nonce { position: fixed; top: 3px; left: 3px; font: 11px/11px monospace; color: #cdd4db; }
  section.filler { min-height: ${FILLER_SECTION_HEIGHT}px; padding: 40px 0; border-top: 1px solid #e2e8ef; }
  section.filler h4 { font-size: 22px; margin-bottom: 10px; }
  section.filler p { font-size: 16px; color: #5d6b7a; max-width: 820px; }
`;

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string);
}

/**
 * Static filler that makes the page tall. Identical in both variants and on every
 * page, so it can never contribute a diff — the case zone is the only moving part.
 */
function filler(): string {
  const topics = [
    ['Getting started', 'Install the SDK, add a snapshot call, and open your first build.'],
    ['Baselines', 'Every build is compared against an approved baseline on the target branch.'],
    ['Review states', 'Snapshots come back as new, changed, unchanged or removed.'],
    ['Regions', 'Scope a rule to part of a page by CSS selector, XPath or bounding box.'],
    ['Parallelism', 'Shard a suite across machines and Percy stitches the build back together.'],
    ['Integrations', 'Status checks on pull requests, with review state carried across.'],
    ['Retention', 'Builds age out after the retention window for your plan.'],
    ['Support', 'Reach the team from the dashboard, or read the docs.'],
  ];
  return topics
    .map(
      ([h, p]) => `    <section class="filler">
      <h4>${esc(h)}</h4>
      <p>${esc(p)}</p>
    </section>`,
    )
    .join('\n');
}

function shell(tag: string, body: string, nonce: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(tag)}</title>
<style>${CSS}</style>
</head>
<body>
  <div class="page">
    <div class="tag">${esc(tag)}</div>
${body}
${filler()}
  </div>
  <div class="nonce">${esc(nonce)}</div>
</body>
</html>`;
}

/**
 * The carousel, rotating one slide. Structure and colour are held constant so this
 * reads as the same component showing different content — a wholesale colour or
 * layout swap is a redesign, which is not what the noise classes recognise.
 */
function carousel(changed: boolean): string {
  const active = changed ? 2 : 0;
  const dots = [0, 1, 2].map((i) => `<span class="dot${i === active ? ' on' : ''}"></span>`).join('');
  return `    <div id="${ZONES.carousel.slice(1)}" class="carousel">
      <h3>${esc(changed ? 'Meet the new dashboard' : 'Spring release is live')}</h3>
      <p>${esc(changed ? 'Faster filters and saved views for every project.' : 'Twelve new integrations, shipped this week.')}</p>
      <div class="dots">${dots}</div>
    </div>`;
}

function priceTable(changed: boolean): string {
  return `    <div id="${ZONES.priceTable.slice(1)}" class="panel">
      <table>
        <tr><th>Plan</th><th>Screenshots / mo</th><th>Price</th></tr>
        <tr><td>Starter</td><td>5,000</td><td class="num">$29</td></tr>
        <tr><td>Growth</td><td>25,000</td><td class="num">${changed ? '$129' : '$99'}</td></tr>
        <tr><td>Scale</td><td>120,000</td><td class="num">$349</td></tr>
      </table>
    </div>`;
}

/** Render one matrix page. `changed` drives the head build; the baseline passes false. */
export function renderMatrixPage(file: string, changed: boolean, nonce = ''): string {
  switch (file) {
    case MATRIX_PAGES.noiseIntelli:
      return shell('A — carousel noise, IntelliIgnore applied (expect SUPPRESSED)', carousel(changed), nonce);
    case MATRIX_PAGES.noiseStandard:
      return shell('B — carousel noise, standard rule (CONTROL, expect FLAGGED)', carousel(changed), nonce);
    case MATRIX_PAGES.signal:
      return shell('C — price change, no rule (SIGNAL, expect FLAGGED)', priceTable(changed), nonce);
    default:
      return shell(
        'D — unchanged control (expect NO diff; any diff here means the harness is lying)',
        `    <div class="panel"><h3>About</h3><p>Shipping visual testing since 2015.</p></div>`,
        nonce,
      );
  }
}
