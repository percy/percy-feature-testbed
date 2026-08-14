import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTallPage, TALL_PAGE_MIN_HEIGHT } from './tall-page';
import { ZONES } from './pages';

test('the page clears the >10,000px target', () => {
  assert.ok(
    TALL_PAGE_MIN_HEIGHT > 10_000,
    `nominal height ${TALL_PAGE_MIN_HEIGHT}px must exceed 10,000px`,
  );
});

test('every region zone is present, so the same rule config applies', () => {
  const html = renderTallPage('baseline');
  for (const selector of Object.values(ZONES)) {
    assert.ok(html.includes(`id="${selector.slice(1)}"`), `carries ${selector}`);
  }
});

test('noise, signal and layout all change together in the changed variant', () => {
  const base = renderTallPage('baseline');
  const changed = renderTallPage('changed');

  // noise
  assert.ok(base.includes('Scheduled maintenance') && changed.includes('region rules are now available'));
  assert.ok(base.includes('Spring release is live') && changed.includes('Meet the new dashboard'));
  assert.ok(base.includes('Ship with confidence') && changed.includes('Scale your test suite'));
  assert.ok(base.includes('09:14') && changed.includes('17:42'));
  // signal — must survive suppression
  assert.ok(base.includes('$99') && changed.includes('$129'));
  // layout
  assert.ok(!base.includes('padding-top:96px') && changed.includes('padding-top:96px'));
});

test('the carousel keeps its structure and colour, changing only the active slide', () => {
  // A wholesale colour/layout swap is a redesign, not the rotating-content pattern
  // the noise classes are meant to recognise — the earlier fixture made that mistake.
  const base = renderTallPage('baseline');
  const changed = renderTallPage('changed');
  assert.ok(base.includes('background:#3b5bdb') && changed.includes('background:#3b5bdb'));
  assert.notEqual(
    base.match(/class="dots">([\s\S]*?)<\/div>/)?.[1],
    changed.match(/class="dots">([\s\S]*?)<\/div>/)?.[1],
    'a different dot is active',
  );
});

test('an unchanged control section catches harness noise', () => {
  const base = renderTallPage('baseline');
  const changed = renderTallPage('changed');
  const section = (html: string) =>
    html.match(/id="unchanged-control"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section(base));
  assert.equal(section(base), section(changed), 'identical in both builds');
});

test('rendering stays deterministic', () => {
  assert.equal(renderTallPage('changed', 'n1'), renderTallPage('changed', 'n1'));
});
