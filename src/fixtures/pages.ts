/**
 * Rendered-DOM fixtures (replaces the solid-colour PNG path).
 *
 * Every page is generated from one source so the variants cannot drift apart, and
 * every difference between variants is baked in — no `Date.now()`, no randomness —
 * so a re-run reproduces the same pixels and QA can trust a diff to mean something.
 *
 * Zones exist to match what Percy's region `algorithmConfiguration` actually knows
 * about (carouselsEnabled / adsEnabled / bannersEnabled), so an IntelliIgnore build
 * has real carousel/ad/banner noise to suppress and a real content change to keep.
 */

/** Stable selectors regions target. Exported so region config and fixtures can't disagree. */
export const ZONES = {
  carousel: '#promo-carousel',
  ad: '#ad-slot',
  banner: '#announcement-banner',
  timestamp: '#last-updated',
  priceTable: '#price-table',
  sidebar: '#sidebar',
} as const;

export type ZoneKey = keyof typeof ZONES;

/**
 * How one page differs from the baseline.
 * - `noise`        — carousel/ad/banner/timestamp change; the price table does NOT.
 * - `signal`       — only the price table changes (must survive IntelliIgnore).
 * - `noise-signal` — both, so QA sees the rule keep the signal and drop the noise.
 * - `layout-shift` — identical content, moved down the page (for the `layout` rule).
 */
export type PageVariant =
  | 'baseline'
  | 'noise'
  | 'signal'
  | 'noise-signal'
  | 'layout-shift'
  /**
   * Classic visual BUGS, for AI bug classification. Percy marks a region
   * `visual_quality: 'irregularity'` with a reason, so the diff has to look like
   * something actually broke — not a benign content edit. Five distinct defects,
   * one per zone, so a classifier has separate things to name.
   */
  | 'visual-bugs';

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #f6f8fa; font-family: -apple-system, "Segoe UI", Arial, sans-serif; color: #14212b; }
  .page { width: 1280px; margin: 0 auto; padding: 40px 48px; }
  .top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .brand { font-size: 20px; font-weight: 800; color: #6b3df0; letter-spacing: .6px; }
  .stamp { font-size: 13px; color: #7a8896; font-variant-numeric: tabular-nums; }
  .banner { border-radius: 10px; padding: 14px 18px; font-size: 16px; font-weight: 600; margin-bottom: 20px; }
  .layout { display: flex; gap: 24px; align-items: flex-start; }
  .main { flex: 1; }
  .side { width: 280px; }
  .carousel { border-radius: 12px; padding: 28px; color: #fff; margin-bottom: 20px; }
  .carousel h2 { font-size: 26px; margin-bottom: 6px; }
  .carousel p { font-size: 15px; opacity: .92; }
  .dots { margin-top: 16px; display: flex; gap: 7px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,.45); }
  .dot.on { background: #fff; }
  .panel { background: #fff; border: 1px solid #e2e8ef; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
  .panel h3 { font-size: 19px; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 11px 8px; font-size: 15px; border-bottom: 1px solid #eef2f6; }
  th { color: #6b7a89; font-size: 13px; text-transform: uppercase; letter-spacing: .4px; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .ad { border: 1px dashed #c9d3de; border-radius: 12px; padding: 22px; text-align: center; }
  .ad .tag { font-size: 11px; color: #93a1b0; letter-spacing: 1px; margin-bottom: 10px; }
  .ad h4 { font-size: 18px; margin-bottom: 6px; }
  .ad p { font-size: 14px; color: #5d6b7a; }
  .nonce { position: fixed; top: 3px; left: 3px; font: 11px/11px monospace; color: #cdd4db; }
`;

interface Carousel { title: string; body: string; color: string; active: number }
interface Ad { tag: string; head: string; body: string }

const CAROUSEL: Record<'a' | 'b', Carousel> = {
  a: { title: 'Spring release is live', body: 'Twelve new integrations, shipped this week.', color: '#3b5bdb', active: 0 },
  b: { title: 'Meet the new dashboard', body: 'Faster filters and saved views for every project.', color: '#0b7285', active: 2 },
};

const AD: Record<'a' | 'b', Ad> = {
  a: { tag: 'SPONSORED', head: 'Ship with confidence', body: 'Catch visual bugs before your users do.' },
  b: { tag: 'SPONSORED', head: 'Scale your test suite', body: 'Parallel runs on 3,000+ real devices.' },
};

const BANNER = {
  a: { text: 'Scheduled maintenance on Sunday 02:00–04:00 UTC.', bg: '#fff4e5', fg: '#8a5300', bd: '#ffd8a8' },
  b: { text: 'New: region rules are now available on all plans.', bg: '#e7f5ff', fg: '#0b5e8a', bd: '#a5d8ff' },
};

const STAMP = { a: 'Last updated 09:14', b: 'Last updated 17:42' };

/** The price table — the SIGNAL. A change here must survive IntelliIgnore. */
const PRICES = {
  a: [
    ['Starter', '5,000', '$29'],
    ['Growth', '25,000', '$99'],
    ['Scale', '120,000', '$349'],
  ],
  b: [
    ['Starter', '5,000', '$29'],
    ['Growth', '25,000', '$129'], // price rise — the change QA must still see
    ['Scale', '120,000', '$349'],
  ],
};

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string);
}

function carouselHtml(c: Carousel): string {
  const dots = [0, 1, 2]
    .map((i) => `<span class="dot${i === c.active ? ' on' : ''}"></span>`)
    .join('');
  return `<div id="promo-carousel" class="carousel" style="background:${c.color}">
        <h2>${esc(c.title)}</h2>
        <p>${esc(c.body)}</p>
        <div class="dots">${dots}</div>
      </div>`;
}

function priceTableHtml(rows: string[][]): string {
  const body = rows
    .map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td class="num">${esc(r[2])}</td></tr>`)
    .join('\n            ');
  return `<div id="price-table" class="panel">
        <h3>Plans &amp; pricing</h3>
        <table>
          <tr><th>Plan</th><th>Screenshots / mo</th><th>Price</th></tr>
            ${body}
        </table>
      </div>`;
}

function adHtml(a: Ad): string {
  return `<div id="ad-slot" class="ad">
          <div class="tag">${esc(a.tag)}</div>
          <h4>${esc(a.head)}</h4>
          <p>${esc(a.body)}</p>
        </div>`;
}

/**
 * The storefront page — the fixture every region rule is demonstrated against.
 * `nonce` renders a near-invisible corner marker so a re-run's pixels are unique
 * (defeats Percy's image-based auto-approve carry-forward). It is identical in the
 * baseline and head of a given run, so it never registers as a diff itself.
 */
export function renderStorefront(variant: PageVariant = 'baseline', nonce = ''): string {
  const noisy = variant === 'noise' || variant === 'noise-signal';
  const changed = variant === 'signal' || variant === 'noise-signal';
  const bugged = variant === 'visual-bugs';

  const car = noisy ? CAROUSEL.b : CAROUSEL.a;
  const ad = noisy ? AD.b : AD.a;
  const ban = noisy ? BANNER.b : BANNER.a;
  const stamp = noisy ? STAMP.b : STAMP.a;
  const prices = changed ? PRICES.b : PRICES.a;

  // layout-shift moves the sidebar down without altering a single character of it,
  // so the `layout` rule has a pure position change to reason about.
  const sideStyle = variant === 'layout-shift' ? ' style="margin-top:96px"' : '';

  if (bugged) return renderBuggedStorefront(nonce);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Storefront</title>
<style>${CSS}</style>
</head>
<body>
  <div class="page">
    <div class="top">
      <div class="brand">PERCY STORE</div>
      <div id="last-updated" class="stamp">${esc(stamp)}</div>
    </div>

    <div id="announcement-banner" class="banner"
         style="background:${ban.bg};color:${ban.fg};border:1px solid ${ban.bd}">${esc(ban.text)}</div>

    <div class="layout">
      <div class="main">
      ${carouselHtml(car)}
      ${priceTableHtml(prices)}
      </div>
      <div id="sidebar" class="side"${sideStyle}>
        ${adHtml(ad)}
      </div>
    </div>
  </div>
  <div class="nonce">${esc(nonce)}</div>
</body>
</html>`;
}

/**
 * The same storefront with five deliberate, visually obvious defects — one per zone,
 * each a different failure class so bug classification has distinct things to name:
 *
 *   carousel   — text unreadable, near-invisible on its background (contrast)
 *   banner     — copy overflows its box and is clipped mid-word
 *   price tbl  — a row's columns misalign and a value overlaps the next cell
 *   ad slot    — image fails to load, leaving a broken placeholder
 *   sidebar    — overlaps the main content instead of sitting beside it
 *
 * Structure and ids are unchanged from the baseline so the diff is the breakage.
 */
function renderBuggedStorefront(nonce = ''): string {
  const c = CAROUSEL.a;
  const ban = BANNER.a;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Storefront</title>
<style>${CSS}</style>
</head>
<body>
  <div class="page">
    <div class="top">
      <div class="brand">PERCY STORE</div>
      <div id="last-updated" class="stamp">${esc(STAMP.a)}</div>
    </div>

    <!-- BUG: copy overflows the banner and is clipped mid-word -->
    <div id="announcement-banner" class="banner"
         style="background:${ban.bg};color:${ban.fg};border:1px solid ${ban.bd};
                white-space:nowrap;overflow:hidden;width:340px;text-overflow:clip">
      ${esc(ban.text)} Please plan your deployments around this window accordingly.
    </div>

    <div class="layout" style="position:relative">
      <div class="main">
        <!-- BUG: carousel copy is near-invisible against its own background -->
        <div id="promo-carousel" class="carousel" style="background:${c.color}">
          <h2 style="color:#4b62d6">${esc(c.title)}</h2>
          <p style="color:#4257c4">${esc(c.body)}</p>
          <div class="dots"><span class="dot on"></span><span class="dot"></span><span class="dot"></span></div>
        </div>

        <!-- BUG: the Growth row misaligns and its price overlaps the next column -->
        <div id="price-table" class="panel">
          <h3>Plans &amp; pricing</h3>
          <table>
            <tr><th>Plan</th><th>Screenshots / mo</th><th>Price</th></tr>
            <tr><td>Starter</td><td>5,000</td><td class="num">$29</td></tr>
            <tr style="position:relative;left:34px">
              <td>Growth</td>
              <td style="white-space:nowrap">25,000<span style="position:relative;left:120px;background:#fff">$99</span></td>
              <td class="num"></td>
            </tr>
            <tr><td>Scale</td><td>120,000</td><td class="num">$349</td></tr>
          </table>
        </div>
      </div>

      <!-- BUG: sidebar overlaps the main column instead of sitting beside it -->
      <div id="sidebar" class="side" style="position:absolute;right:0;top:120px;left:640px">
        <div id="ad-slot" class="ad">
          <div class="tag">SPONSORED</div>
          <!-- BUG: image never loads, leaving a broken placeholder -->
          <img src="./missing-hero.png" alt="Ship with confidence" width="180" height="90">
          <p>Catch visual bugs before your users do.</p>
        </div>
      </div>
    </div>
  </div>
  <div class="nonce">${esc(nonce)}</div>
</body>
</html>`;
}

/** A second, quieter page so builds contain more than one snapshot. */
export function renderPricing(nonce = ''): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Pricing</title>
<style>${CSS}</style>
</head>
<body>
  <div class="page">
    <div class="top"><div class="brand">PERCY STORE</div></div>
    ${priceTableHtml(PRICES.a)}
    <div class="panel"><h3>Frequently asked</h3>
      <p style="font-size:15px;color:#5d6b7a">Annual billing saves two months on every plan.</p>
    </div>
  </div>
  <div class="nonce">${esc(nonce)}</div>
</body>
</html>`;
}

/** An extra page, present only in the `new` set, to produce a NEW snapshot. */
export function renderAbout(nonce = ''): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>About</title>
<style>${CSS}</style>
</head>
<body>
  <div class="page">
    <div class="top"><div class="brand">PERCY STORE</div></div>
    <div class="panel"><h3>About us</h3>
      <p style="font-size:15px;color:#5d6b7a">We have been shipping visual testing since 2015.</p>
    </div>
  </div>
  <div class="nonce">${esc(nonce)}</div>
</body>
</html>`;
}
