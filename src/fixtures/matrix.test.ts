import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderMatrixPage,
  MATRIX_PAGES,
  EXPECTED_DIFF_WORKING,
  EXPECTED_DIFF_NOOP,
} from './matrix';
import { buildMatrixConfig } from './rules';
import { ZONES } from './pages';

test('the working and no-op outcomes are different numbers, so the test can fail', () => {
  assert.notEqual(EXPECTED_DIFF_WORKING, EXPECTED_DIFF_NOOP);
});

test('the two carousel pages change identically — only the rule differs', () => {
  const a = renderMatrixPage(MATRIX_PAGES.noiseIntelli, false);
  const aC = renderMatrixPage(MATRIX_PAGES.noiseIntelli, true);
  const b = renderMatrixPage(MATRIX_PAGES.noiseStandard, false);
  const bC = renderMatrixPage(MATRIX_PAGES.noiseStandard, true);

  // Strip the heading, which names the rule; the carousel markup must be identical.
  const carouselOf = (html: string) => html.match(/<div id="promo-carousel"[\s\S]*?<\/div>\s*<\/div>/)?.[0];
  assert.equal(carouselOf(a), carouselOf(b), 'baselines identical');
  assert.equal(carouselOf(aC), carouselOf(bC), 'changed variants identical');
  assert.notEqual(carouselOf(a), carouselOf(aC), 'and they actually change');
});

test('the unchanged page is byte-identical across both builds', () => {
  assert.equal(
    renderMatrixPage(MATRIX_PAGES.unchanged, false, 'n1'),
    renderMatrixPage(MATRIX_PAGES.unchanged, true, 'n1'),
  );
});

test('the signal page changes the price and carries no carousel', () => {
  const base = renderMatrixPage(MATRIX_PAGES.signal, false);
  const changed = renderMatrixPage(MATRIX_PAGES.signal, true);
  assert.ok(base.includes('$99') && changed.includes('$129'));
  assert.ok(!base.includes(ZONES.carousel.slice(1)));
});

test('config applies intelliignore to page A and standard to page B, nothing to C/D', () => {
  const cfg = buildMatrixConfig() as any;
  const opts = cfg.static.options;
  assert.equal(opts.length, 2, 'only the two carousel pages carry rules');

  const byPage = Object.fromEntries(opts.map((o: any) => [o.include, o.regions[0]]));
  assert.equal(byPage[`/${MATRIX_PAGES.noiseIntelli}`].algorithm, 'intelliignore');
  assert.equal(byPage[`/${MATRIX_PAGES.noiseStandard}`].algorithm, 'standard');
  assert.equal(
    byPage[`/${MATRIX_PAGES.noiseIntelli}`].elementSelector.elementCSS,
    ZONES.carousel,
  );
});
