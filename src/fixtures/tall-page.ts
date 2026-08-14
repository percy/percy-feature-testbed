/**
 * A single tall page (>10,000px) carrying every case at once.
 *
 * Two problems with the short single-zone fixtures drove this:
 *
 * 1. A build that suppresses its only change shows ZERO diffs — an absence, not a
 *    demonstration. There is nothing for QA to look at and no way to tell
 *    "the rule suppressed it" from "no comparison was computed". Percy reported
 *    `total-comparisons-with-ai: 0` on exactly such a build.
 * 2. One case per build means one build per case.
 *
 * Here every zone changes in the same snapshot, so a single comparison shows the
 * suppressed regions and the flagged ones side by side, and the difference between
 * them is visible rather than inferred.
 *
 * Section ids match `ZONES` so the same region config applies.
 */
import { ZONES } from './pages';

/** Each section is tall enough that eight of them clear the 10,000px target. */
const SECTION_MIN_HEIGHT = 1400;

export type TallVariant = 'baseline' | 'changed';

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #f6f8fa; font-family: -apple-system, "Segoe UI", Arial, sans-serif; color: #14212b; }
  .page { width: 1280px; margin: 0 auto; }
  section { min-height: ${SECTION_MIN_HEIGHT}px; padding: 48px; border-bottom: 1px solid #e2e8ef; }
  .tag { font-size: 12px; letter-spacing: 1.4px; color: #93a1b0; margin-bottom: 10px; }
  h2 { font-size: 30px; margin-bottom: 10px; }
  .hint { font-size: 15px; color: #5d6b7a; margin-bottom: 26px; }
  .carousel { border-radius: 12px; padding: 40px; color: #fff; }
  .carousel h3 { font-size: 30px; margin-bottom: 8px; }
  .dots { margin-top: 20px; display: flex; gap: 8px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: rgba(255,255,255,.45); }
  .dot.on { background: #fff; }
  .banner { border-radius: 10px; padding: 20px 24px; font-size: 18px; font-weight: 600; }
  .ad { border: 1px dashed #c9d3de; border-radius: 12px; padding: 40px; text-align: center; }
  .ad h4 { font-size: 22px; margin-bottom: 8px; }
  .stamp { font-size: 20px; color: #7a8896; font-variant-numeric: tabular-nums; }
  .panel { background: #fff; border: 1px solid #e2e8ef; border-radius: 12px; padding: 28px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 13px 10px; font-size: 16px; border-bottom: 1px solid #eef2f6; }
  th { color: #6b7a89; font-size: 13px; text-transform: uppercase; letter-spacing: .4px; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .cols { display: flex; gap: 24px; align-items: flex-start; }
  .card { flex: 1; background: #fff; border: 1px solid #e2e8ef; border-radius: 12px; padding: 24px; }
  .nonce { position: fixed; top: 3px; left: 3px; font: 11px/11px monospace; color: #cdd4db; }
`;

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string);
}

/** id, heading, and what each section is here to demonstrate. */
interface Section {
  id: string;
  title: string;
  hint: string;
  body: (changed: boolean) => string;
}

const SECTIONS: Section[] = [
  {
    id: ZONES.banner.slice(1),
    title: '1 — Announcement banner (noise)',
    hint: 'Copy rotates between deploys. IntelliIgnore should absorb it.',
    body: (c) =>
      c
        ? `<div class="banner" style="background:#e7f5ff;color:#0b5e8a;border:1px solid #a5d8ff">New: region rules are now available on all plans.</div>`
        : `<div class="banner" style="background:#fff4e5;color:#8a5300;border:1px solid #ffd8a8">Scheduled maintenance on Sunday 02:00–04:00 UTC.</div>`,
  },
  {
    id: ZONES.carousel.slice(1),
    title: '2 — Promo carousel (noise)',
    hint: 'A different slide is active on each render. Structure and colour stay put.',
    body: (c) => {
      const active = c ? 2 : 0;
      const dots = [0, 1, 2].map((i) => `<span class="dot${i === active ? ' on' : ''}"></span>`).join('');
      // Structure and background are held constant so this reads as the SAME carousel
      // showing a different slide — a wholesale colour/layout swap is a redesign, not
      // the rotating-content pattern the noise classes are meant to recognise.
      return `<div class="carousel" style="background:#3b5bdb">
        <h3>${esc(c ? 'Meet the new dashboard' : 'Spring release is live')}</h3>
        <p>${esc(c ? 'Faster filters and saved views for every project.' : 'Twelve new integrations, shipped this week.')}</p>
        <div class="dots">${dots}</div>
      </div>`;
    },
  },
  {
    id: ZONES.ad.slice(1),
    title: '3 — Ad slot (noise)',
    hint: 'Third-party creative, different every load.',
    body: (c) => `<div class="ad">
        <div class="tag">SPONSORED</div>
        <h4>${esc(c ? 'Scale your test suite' : 'Ship with confidence')}</h4>
        <p>${esc(c ? 'Parallel runs on 3,000+ real devices.' : 'Catch visual bugs before your users do.')}</p>
      </div>`,
  },
  {
    id: ZONES.timestamp.slice(1),
    title: '4 — Last-updated stamp (noise)',
    hint: 'Dynamic data. Changes on every render by definition.',
    body: (c) => `<div class="stamp">Last updated ${c ? '17:42' : '09:14'}</div>`,
  },
  {
    id: ZONES.priceTable.slice(1),
    title: '5 — Price table (SIGNAL — must stay flagged)',
    hint: 'A real product change. If a rule suppresses this, the rule is too aggressive.',
    body: (c) => `<div class="panel">
        <table>
          <tr><th>Plan</th><th>Screenshots / mo</th><th>Price</th></tr>
          <tr><td>Starter</td><td>5,000</td><td class="num">$29</td></tr>
          <tr><td>Growth</td><td>25,000</td><td class="num">${c ? '$129' : '$99'}</td></tr>
          <tr><td>Scale</td><td>120,000</td><td class="num">$349</td></tr>
        </table>
      </div>`,
  },
  {
    id: ZONES.sidebar.slice(1),
    title: '6 — Layout shift',
    hint: 'Identical content, displaced 96px. For the layout rule.',
    body: (c) => `<div class="cols"${c ? ' style="padding-top:96px"' : ''}>
        <div class="card"><h4>Docs</h4><p>Guides and API reference.</p></div>
        <div class="card"><h4>Support</h4><p>Talk to a human.</p></div>
        <div class="card"><h4>Status</h4><p>All systems operational.</p></div>
      </div>`,
  },
  {
    id: 'visual-bug',
    title: '7 — Visual bug (for AI classification)',
    hint: 'Text overflows its container and is clipped mid-word.',
    body: (c) =>
      c
        ? `<div class="panel" style="white-space:nowrap;overflow:hidden;width:320px;font-size:18px">
             Your plan renews on the 30th and the card ending 4242 will be charged automatically.
           </div>`
        : `<div class="panel" style="font-size:18px">Your plan renews on the 30th.</div>`,
  },
  {
    id: 'unchanged-control',
    title: '8 — Unchanged control',
    hint: 'Identical in both builds. Any diff reported here is noise in the harness itself.',
    body: () => `<div class="panel"><h4>About</h4><p>Shipping visual testing since 2015.</p></div>`,
  },
];

/**
 * Render the tall page. Every section differs between `baseline` and `changed`
 * except the last, which is a harness sanity check.
 */
export function renderTallPage(variant: TallVariant = 'baseline', nonce = ''): string {
  const changed = variant === 'changed';
  const body = SECTIONS.map(
    (s) => `    <section id="${s.id}">
      <div class="tag">${esc(s.title)}</div>
      <p class="hint">${esc(s.hint)}</p>
      ${s.body(changed)}
    </section>`,
  ).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Testbed — all cases</title>
<style>${CSS}</style>
</head>
<body>
  <div class="page">
${body}
  </div>
  <div class="nonce">${esc(nonce)}</div>
</body>
</html>`;
}

/** Nominal rendered height, asserted in tests so the >10,000px target can't silently regress. */
export const TALL_PAGE_MIN_HEIGHT = SECTIONS.length * SECTION_MIN_HEIGHT;
