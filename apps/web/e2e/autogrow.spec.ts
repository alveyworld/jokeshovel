import { expect, test, type Locator, type Page } from '@playwright/test';
import { createTopic, signIn, stepLink, waitForSaved } from './helpers';

// Text boxes grow to fit their text (phones can't drag a text box's corner).
// Chromium does it with CSS field-sizing; the "fallback" runs pretend the
// browser lacks it, so lib/autoGrow.ts has to do the work instead.

const LONG =
  'I love airports because they are the only place where drinking a beer at six in the morning ' +
  'is called pacing yourself, where a sandwich costs more than the flight, and where everyone ' +
  'agrees that the moving walkway is a ride. Also the gate agent knows my name now, which is ' +
  'either a sign of loyalty or a cry for help. ' +
  'The man next to me at the gate has been on the phone since Tuesday, and I now know his whole divorce.';

/** Makes the app believe this browser can't size text boxes in CSS. */
async function withoutFieldSizing(page: Page) {
  await page.addInitScript(() => {
    const supports = CSS.supports.bind(CSS);
    CSS.supports = ((...args: [string, string?]) =>
      args[0] === 'field-sizing' ? false : supports(...(args as [string, string]))) as typeof CSS.supports;
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'textarea { field-sizing: fixed !important; }';
      document.head.append(style);
    });
  });
}

const size = (box: Locator) =>
  box.evaluate((el: HTMLTextAreaElement) => ({
    height: el.getBoundingClientRect().height,
    hidden: el.scrollHeight - el.clientHeight,
    lineHeight: parseFloat(getComputedStyle(el).lineHeight),
  }));

/** Typing a lot makes the box taller with nothing hidden; clearing it shrinks it back. */
async function growsAndShrinks(box: Locator) {
  const empty = await size(box);
  await box.fill(LONG);
  await expect.poll(async () => (await size(box)).hidden).toBeLessThanOrEqual(1);
  const full = await size(box);
  expect(full.height).toBeGreaterThanOrEqual(empty.height + full.lineHeight - 1);
  await box.fill('');
  await expect.poll(async () => Math.round((await size(box)).height)).toBe(Math.round(empty.height));
}

for (const mode of ['css', 'fallback'] as const) {
  test.describe(`${mode === 'css' ? 'CSS field-sizing' : 'script fallback'}`, () => {
    test.beforeEach(async ({ page }) => {
      if (mode === 'fallback') await withoutFieldSizing(page);
    });

    test('topic description and setups grow with their text', async ({ page }) => {
      await signIn(page);
      await createTopic(page, 'Airports');
      // A two-line box to start with.
      const description = page.getByRole('textbox', { name: 'Description' });
      const start = await size(description);
      expect(start.height).toBeGreaterThanOrEqual(2 * start.lineHeight);
      await growsAndShrinks(description);

      await page.getByRole('link', { name: /Setups/ }).click();
      await page.getByRole('button', { name: '+ New setup' }).click();
      await growsAndShrinks(page.getByRole('textbox', { name: 'Setup 1', exact: true }));

      // Saved text that's already long opens at full height.
      await description.fill(LONG);
      await waitForSaved(page);
      await page.reload();
      await expect(description).toHaveValue(LONG);
      await expect.poll(async () => (await size(description)).hidden).toBeLessThanOrEqual(1);
    });

    test('Joke Mine boxes and the index card grow, staying on the rules', async ({ page }) => {
      await signIn(page);
      await createTopic(page, 'Airports');
      await page.getByRole('link', { name: /Setups/ }).click();
      await page.getByRole('button', { name: '+ New setup' }).click();
      await page.getByRole('textbox', { name: 'Setup 1', exact: true }).fill('My flight had a six-hour layover.');
      await page.getByRole('link', { name: 'Mine this setup — Setup 1' }).click();
      await page.getByRole('button', { name: /Start (a joke|another) attempt/ }).click();
      await stepLink(page, 'Punch').click();
      await growsAndShrinks(page.getByRole('textbox', { name: 'Punch' }));

      await page.getByRole('textbox', { name: 'Punch' }).fill('So I did loop-de-loops on the tarmac.');
      await page.getByRole('link', { name: 'Next: Review' }).click();
      await page.getByRole('button', { name: 'Mark as complete' }).click();
      await expect(page).toHaveURL(/\/j\/[^/]+$/);
      const setup = page.getByRole('region', { name: 'The joke' }).getByRole('textbox', { name: 'Setup', exact: true });
      await setup.fill(LONG);
      await expect.poll(async () => (await size(setup)).hidden).toBeLessThanOrEqual(1);
      // A whole number of ruled lines, so the punch below still starts on a rule.
      const { height, lineHeight } = await size(setup);
      expect(height / lineHeight).toBeCloseTo(Math.round(height / lineHeight), 1);
    });
  });
}
