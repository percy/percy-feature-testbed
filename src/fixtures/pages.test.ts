import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderStorefront, ZONES } from './pages';

/** Marker strings that identify each zone's two states. */
const NOISE_MARKERS = [
  ['Spring release is live', 'Meet the new dashboard'], // carousel
  ['Ship with confidence', 'Scale your test suite'], // ad
  ['Scheduled maintenance', 'region rules are now available'], // banner
  ['Last updated 09:14', 'Last updated 17:42'], // timestamp
];
const PRICE_A = '$99';
const PRICE_B = '$129';

test('noise variant changes every noise zone and leaves the price table alone', () => {
  const base = renderStorefront('baseline');
  const noise = renderStorefront('noise');

  for (const [a, b] of NOISE_MARKERS) {
    assert.ok(base.includes(a), `baseline has "${a}"`);
    assert.ok(noise.includes(b), `noise has "${b}"`);
    assert.ok(!noise.includes(a), `noise no longer has "${a}"`);
  }
  // The signal must be untouched — otherwise the IntelliIgnore scenario is meaningless.
  assert.ok(base.includes(PRICE_A) && noise.includes(PRICE_A));
  assert.ok(!noise.includes(PRICE_B));
});

test('signal variant changes only the price table', () => {
  const base = renderStorefront('baseline');
  const signal = renderStorefront('signal');

  assert.ok(signal.includes(PRICE_B), 'the price rise is present');
  assert.ok(!signal.includes(PRICE_A));
  for (const [a] of NOISE_MARKERS) {
    assert.ok(signal.includes(a), `noise zone "${a}" is unchanged`);
  }
  assert.notEqual(base, signal);
});

test('noise-signal variant changes both', () => {
  const both = renderStorefront('noise-signal');
  assert.ok(both.includes(PRICE_B));
  for (const [, b] of NOISE_MARKERS) assert.ok(both.includes(b));
});

test('layout-shift moves the sidebar without altering any content', () => {
  const base = renderStorefront('baseline');
  const shifted = renderStorefront('layout-shift');

  assert.ok(shifted.includes('margin-top:96px'), 'the sidebar is displaced');
  // Strip the one style difference: everything else must be byte-identical.
  assert.equal(shifted.replace(' style="margin-top:96px"', ''), base);
});

test('rendering is deterministic, so a re-run reproduces the same pixels', () => {
  assert.equal(renderStorefront('noise', 'abc'), renderStorefront('noise', 'abc'));
  assert.notEqual(renderStorefront('noise', 'abc'), renderStorefront('noise', 'xyz'));
});

test('every zone selector regions target is actually present in the page', () => {
  const html = renderStorefront('baseline');
  for (const selector of Object.values(ZONES)) {
    assert.ok(html.includes(`id="${selector.slice(1)}"`), `page carries ${selector}`);
  }
});
