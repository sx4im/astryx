// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file BottomSheetContentPull.a11y.browser.spec.ts
 * @input The built "Tall Sheet" BottomSheet story, on a phone viewport with
 *   real touch input through the interaction harness
 * @output Real-engine proof that a finger's pull down on the sheet's content
 *   is the touch listeners' drag: no element takes pointer capture, and the
 *   sheet follows the finger. In Chromium, whose touches carry the script's
 *   timestamps, a fast flick of three moves on the content closes the sheet.
 * @position Chromium and WebKit. Only a shipping engine raises a finger's
 *   pointer events before its touch events and moves its pointer capture.
 */

import {
  expect,
  test,
  type Locator,
  type Page,
} from '@astryxdesign/a11y-spec/playwright';
import {
  DEFAULT_STORYBOOK_DIR,
  serveStorybook,
  type StaticServer,
} from '@astryxdesign/a11y-spec/storybook';
import {touchDriver, type TouchScript} from '@astryxdesign/interaction-harness';

let storybook: StaticServer;
test.beforeAll(async () => {
  storybook = await serveStorybook(
    process.env.ASTRYX_STORYBOOK_DIR ?? DEFAULT_STORYBOOK_DIR,
  );
});
test.afterAll(async () => {
  await storybook?.close();
});

test.use({viewport: {width: 390, height: 844}, hasTouch: true});

// Each element that takes pointer capture, by tag name.
const CAPTURE_LOG = `(() => {
  const captures = [];
  Object.assign(window, {pointerCaptures: captures});
  const capture = Element.prototype.setPointerCapture;
  Element.prototype.setPointerCapture = function (pointerId) {
    captures.push(this.tagName);
    return capture.call(this, pointerId);
  };
})()`;

async function openSheet(
  page: Page,
): Promise<{dialog: Locator; sheet: Locator}> {
  await page.goto(
    `${storybook.origin}/iframe.html?id=core-bottomsheet--tall-sheet&viewMode=story`,
  );
  await page.getByRole('button', {name: 'Open nearby places'}).click();
  const dialog = page.getByRole('dialog', {name: 'Nearby places'});
  await expect(dialog).toBeVisible();
  const sheet = dialog.locator('.astryx-bottom-sheet').first();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          !document
            .getAnimations()
            .some(animation => animation.playState === 'running'),
      ),
    )
    .toBe(true);
  return {dialog, sheet};
}

/** A point on the list, 180 px below the sheet's top edge. */
async function contentPoint(sheet: Locator): Promise<{x: number; y: number}> {
  const box = await sheet.boundingBox();
  if (box == null) {
    throw new Error('The sheet has no box');
  }
  return {x: Math.round(box.x + box.width / 2), y: Math.round(box.y + 180)};
}

function offsetOf(transform: string): number {
  const match = /translateY\((-?[\d.]+)px\)/.exec(transform);
  return match ? Number(match[1]) : 0;
}

test('a pull down on the content takes no pointer capture and follows the finger', async ({
  page,
}) => {
  await page.addInitScript(CAPTURE_LOG);
  const {dialog, sheet} = await openSheet(page);
  const from = await contentPoint(sheet);
  const driver = await touchDriver(page);
  const finger = await driver.press(from);
  // Chromium keeps a touchmove inside its own touch slop from the page, so
  // the sheet is read from the second move on.
  const travel = [12, 40, 90, 150];
  const offsets: number[] = [];
  for (const dy of travel) {
    await finger.move({x: from.x, y: from.y + dy});
    offsets.push(
      offsetOf(await sheet.evaluate(el => (el as HTMLElement).style.transform)),
    );
  }
  expect(
    await page.evaluate(
      () => (window as unknown as {pointerCaptures: string[]}).pointerCaptures,
    ),
  ).toEqual([]);
  expect(offsets.slice(1)).toEqual(travel.slice(1));
  await finger.lift();
  await expect(dialog).toBeVisible();
});

test('a fast flick of three moves on the content closes the sheet', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'WebKit stamps a touch when it arrives, so a three-move flick has no fixed speed there',
  );
  const {dialog, sheet} = await openSheet(page);
  const {x, y} = await contentPoint(sheet);
  const driver = await touchDriver(page);
  // 150 px in 48 ms. The last two intervals run at 3,750 and 3,125 px/s, far
  // past the speed a release is a flick from.
  const flick: TouchScript = [
    {t: 0, fingers: [{id: 0, x, y}]},
    {t: 16, fingers: [{id: 0, x, y: y + 40}]},
    {t: 32, fingers: [{id: 0, x, y: y + 90}]},
    {t: 48, fingers: [{id: 0, x, y: y + 150}]},
    {t: 52, fingers: []},
  ];
  await driver.play(flick);
  await expect(dialog).toBeHidden();
});
