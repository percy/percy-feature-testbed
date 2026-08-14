import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPercyConfig, NOISE_ZONES, INTELLI_NOISE_CONFIG, FIXTURE_WIDTH } from './rules';
import { ZONES } from './pages';
import { HOME } from './sets';

test('no rules produces a config with no snapshot overrides', () => {
  assert.deepEqual(buildPercyConfig([]), { version: 2, snapshot: { widths: [FIXTURE_WIDTH] } });
});

test('width is pinned so the fixed-width fixtures fully render', () => {
  // At Percy's default 375px the price table falls outside the render and a real
  // change produces no diff — the signal vanishes without any error.
  const cfg = buildPercyConfig([{ zones: ['carousel'], algorithm: 'ignore' }]) as any;
  assert.deepEqual(cfg.snapshot.widths, [FIXTURE_WIDTH]);
});

test('a rule becomes one region per zone, scoped to the storefront page', () => {
  const cfg = buildPercyConfig([
    { zones: NOISE_ZONES, algorithm: 'intelliignore', configuration: INTELLI_NOISE_CONFIG },
  ]) as any;

  assert.equal(cfg.static.options[0].include, `/${HOME}`);

  const regions = cfg.static.options[0].regions;
  assert.equal(regions.length, NOISE_ZONES.length);
  assert.deepEqual(
    regions.map((r: any) => r.elementSelector.elementCSS),
    NOISE_ZONES.map((z) => ZONES[z]),
  );
  assert.ok(regions.every((r: any) => r.algorithm === 'intelliignore'));
});

test('IntelliIgnore turns on the noise classes it actually knows about', () => {
  const cfg = buildPercyConfig([
    { zones: ['carousel'], algorithm: 'intelliignore', configuration: INTELLI_NOISE_CONFIG },
  ]) as any;
  const { configuration } = cfg.static.options[0].regions[0];

  assert.equal(configuration.carouselsEnabled, true);
  assert.equal(configuration.bannersEnabled, true);
  assert.equal(configuration.adsEnabled, true);
});

test('a rule without configuration omits the key rather than sending an empty object', () => {
  const cfg = buildPercyConfig([{ zones: ['carousel'], algorithm: 'ignore' }]) as any;
  assert.ok(!('configuration' in cfg.static.options[0].regions[0]));
});

test('multiple rules coexist in one config', () => {
  const cfg = buildPercyConfig([
    { zones: ['carousel'], algorithm: 'ignore' },
    { zones: ['sidebar'], algorithm: 'layout' },
  ]) as any;

  const regions = cfg.static.options[0].regions;
  assert.deepEqual(
    regions.map((r: any) => r.algorithm),
    ['ignore', 'layout'],
  );
});
