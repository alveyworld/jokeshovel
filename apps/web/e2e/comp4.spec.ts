import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { openSetup, signIn, stepLink, waitForSaved } from './helpers';

// COMP-4: completed jokes look like 3×5 index cards (docs/DESIGN.md AC-35 to AC-41).

const SETUP = 'The guy next to me reclined his seat all the way back before we even left the gate.';
const PUNCH = 'Now I’m writing this from his lap.';

const mainNav = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name }).click();

/** Topic → setup → attempt → punch → complete. Leaves the page on the new joke. */
async function finishJoke(page: Page, title = 'Recliner') {
  await openSetup(page, 'Airports', SETUP);
  await page.getByRole('button', { name: /Start (a joke|another) attempt/ }).click();
  await stepLink(page, 'Punch').click();
  await page.getByRole('textbox', { name: 'Punch' }).fill(PUNCH);
  await page.getByRole('link', { name: 'Next: Review' }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill(title);
  await page.getByRole('button', { name: 'Mark as complete' }).click();
  await expect(page).toHaveURL(/\/j\/[^/]+$/);
}

/**
 * Every line of text in a ruled area sits on the rules: its line height is the
 * rule spacing, and it starts and ends on a rule.
 */
async function textOnRules(lines: Locator) {
  return lines.evaluate((el) => {
    const rule = parseFloat(getComputedStyle(el).backgroundSize.split(' ')[1]);
    const top = el.getBoundingClientRect().top;
    const onRule = (px: number) => Math.abs(px / rule - Math.round(px / rule)) < 0.04;
    const problems: string[] = [];
    const rows = Array.from(el.querySelectorAll<HTMLElement>(':scope > span, textarea'));
    for (const row of rows) {
      const box = row.getBoundingClientRect();
      const name = row.className || row.tagName;
      const lineHeight = parseFloat(getComputedStyle(row).lineHeight);
      if (Math.abs(lineHeight - rule) > 0.5) problems.push(`${name}: line height ${lineHeight}, rules ${rule}`);
      if (!onRule(box.top - top)) problems.push(`${name}: starts ${box.top - top}px down, rules every ${rule}px`);
      if (!onRule(box.height)) problems.push(`${name}: ${box.height}px tall, rules every ${rule}px`);
      if (row.scrollHeight > row.clientHeight + 1) problems.push(`${name}: text is cut off`);
    }
    return { rule, rows: rows.length, problems };
  });
}

/** Relative luminance and contrast, from computed rgb() colours. */
async function cardColours(card: Locator, text: Locator) {
  const [bg, fg] = await Promise.all([
    card.evaluate((el) => getComputedStyle(el).backgroundColor),
    text.evaluate((el) => getComputedStyle(el).color),
  ]);
  const lum = (rgb: string) => {
    const [r, g, b] = rgb
      .match(/\d+(\.\d+)?/g)!
      .slice(0, 3)
      .map(Number)
      .map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [lb, lf] = [lum(bg), lum(fg)];
  return { background: lb, contrast: (Math.max(lb, lf) + 0.05) / (Math.min(lb, lf) + 0.05) };
}

async function axe(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    serious.map((v) => `${label}: ${v.id} — ${v.help} @ ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
}

test('completed jokes are 3×5 index cards on both Jokes tabs, details included (AC-35, AC-38, AC-41)', async ({
  page,
}) => {
  await signIn(page);
  await finishJoke(page);
  await page.getByRole('button', { name: 'Favorite joke' }).click();
  await page.locator('label').filter({ hasText: '4 stars' }).click();
  await page.getByRole('combobox', { name: 'Add a tag' }).fill('Opener');
  await Promise.all([
    page.waitForResponse((r) => /\/rpc\/set_joke_tags/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Add tag' }).click(),
  ]);
  await waitForSaved(page);

  await mainNav(page, 'Jokes');
  const card = page.getByRole('list', { name: '1 joke' }).getByRole('link');
  await expect(card).toHaveClass(/\bindex-card\b/);
  // The title is above the red line; the joke and its details are on the rules.
  await expect(card.locator('.index-card__head')).toContainText('Recliner');
  await expect(card.locator('.index-card__head')).toContainText('Airports');
  const lines = card.locator('.index-card__lines');
  await expect(lines).toContainText(PUNCH);
  await expect(lines).toContainText('Opener');
  await expect(lines).toContainText('Rated 4 of 5');
  await expect(lines).toContainText(/completed/);

  const look = await card.evaluate((el) => {
    const head = getComputedStyle(el.querySelector('.index-card__head')!);
    const box = el.getBoundingClientRect();
    return {
      ratio: box.height / box.width,
      red: head.borderBottomColor,
      redWidth: head.borderBottomWidth,
      rules: getComputedStyle(el.querySelector('.index-card__lines')!).backgroundImage,
      shadow: getComputedStyle(el).boxShadow,
    };
  });
  expect(look.ratio).toBeGreaterThanOrEqual(0.595);
  expect(look.redWidth).toBe('2px');
  const [r, g, b] = look.red.match(/\d+/g)!.map(Number);
  expect(r).toBeGreaterThan(g + 60);
  expect(r).toBeGreaterThan(b + 60);
  expect(look.rules).toContain('linear-gradient');
  expect(look.shadow).not.toBe('none');
  expect((await cardColours(card, lines)).background).toBeGreaterThan(0.95);
  const ruled = await textOnRules(lines);
  expect(ruled.rows).toBe(4);
  expect(ruled.problems).toEqual([]);

  // The topic's Jokes tab uses the same card.
  await mainNav(page, 'Topics');
  await page
    .getByRole('list', { name: /topics$/ })
    .getByRole('link', { name: /^Airports/ })
    .click();
  await page.getByRole('navigation', { name: 'Topic sections' }).getByRole('link', { name: /Jokes/ }).click();
  await expect(page.getByRole('list', { name: '1 joke' }).getByRole('link')).toHaveClass(/\bindex-card\b/);

  // Work in progress keeps the legal pad.
  for (const name of ['Associations', 'Setups']) {
    await page
      .getByRole('navigation', { name: 'Topic sections' })
      .getByRole('link', { name: new RegExp(name) })
      .click();
    await expect(page.locator('.index-card')).toHaveCount(0);
  }
  await mainNav(page, 'Topics');
  await expect(page.getByRole('list', { name: /topics$/ })).toBeVisible();
  await expect(page.locator('.index-card')).toHaveCount(0);
  await mainNav(page, 'Drafts');
  await expect(page.locator('.index-card')).toHaveCount(0);
});

test('the joke page is one card, edited in place with the text on the rules (AC-36, AC-37)', async ({ page }) => {
  await signIn(page);
  await finishJoke(page);
  const card = page.getByRole('region', { name: 'The joke' });
  await expect(card).toHaveClass(/\bindex-card\b/);
  await expect(card.getByRole('textbox', { name: 'Title' })).toHaveValue('Recliner');
  await expect(card.getByRole('textbox', { name: 'Setup', exact: true })).toHaveValue(SETUP);
  await expect(card.getByRole('textbox', { name: 'Punch' })).toHaveValue(PUNCH);
  // Rating and tags stay below the card.
  const cardBottom = (await card.boundingBox())!.y + (await card.boundingBox())!.height;
  expect((await page.getByRole('group', { name: 'Rating' }).boundingBox())!.y).toBeGreaterThan(cardBottom);
  expect((await page.getByRole('combobox', { name: 'Add a tag' }).boundingBox())!.y).toBeGreaterThan(cardBottom);

  const lines = card.locator('.index-card__lines');
  expect((await textOnRules(lines)).problems).toEqual([]);

  // A longer setup wraps onto more lines; the punch moves down a whole line.
  const longer = `${SETUP} He said it was a "business decision." I said so is me sitting on your lap.`;
  await card.getByRole('textbox', { name: 'Setup', exact: true }).fill(longer);
  await card.getByRole('textbox', { name: 'Title' }).fill('Recliner, revised');
  const after = await textOnRules(lines);
  expect(after.problems).toEqual([]);
  await waitForSaved(page);
  await page.reload();
  await expect(card.getByRole('textbox', { name: 'Setup', exact: true })).toHaveValue(longer);
  await expect(card.getByRole('textbox', { name: 'Title' })).toHaveValue('Recliner, revised');
});

test('the rules follow the text at 200% text size, nothing is cut off, and cards fit 320px (AC-37, AC-40)', async ({
  page,
}) => {
  await signIn(page);
  await finishJoke(page);
  const jokeUrl = page.url();
  for (const width of [320, 1000]) {
    await page.setViewportSize({ width, height: 800 });
    for (const size of ['100%', '200%']) {
      await page.goto(jokeUrl);
      await page.evaluate((s) => (document.documentElement.style.fontSize = s), size);
      const big = page.getByRole('region', { name: 'The joke' }).locator('.index-card__lines');
      expect((await textOnRules(big)).problems, `joke page, ${width}px, ${size}`).toEqual([]);
      await page.goto('/jokes');
      await page.evaluate((s) => (document.documentElement.style.fontSize = s), size);
      const card = page.getByRole('list', { name: '1 joke' }).getByRole('link');
      expect((await textOnRules(card.locator('.index-card__lines'))).problems, `list, ${width}px, ${size}`).toEqual([]);
      expect(await card.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (size === '100%') expect(overflow, `no sideways scroll at ${width}px`).toBeLessThanOrEqual(0);
    }
  }
});

test('in the dark theme the card is dimmed and still readable (AC-39)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await signIn(page);
  await finishJoke(page);
  const big = page.getByRole('region', { name: 'The joke' });
  const onPage = await cardColours(big, big.getByRole('textbox', { name: 'Punch' }));
  expect(onPage.background).toBeLessThan(0.1);
  expect(onPage.contrast).toBeGreaterThanOrEqual(4.5);

  await mainNav(page, 'Jokes');
  const card = page.getByRole('list', { name: '1 joke' }).getByRole('link');
  const inList = await cardColours(card, card.locator('.index-card__meta'));
  expect(inList.background).toBeLessThan(0.1);
  expect(inList.contrast).toBeGreaterThanOrEqual(4.5);
});

test('the lines are decoration only: same names, high contrast, no axe issues (AC-40)', async ({ page }) => {
  test.skip(test.info().project.name === 'mobile', 'sticky-footer false positive; see sprint1.spec.ts');
  await signIn(page);
  await finishJoke(page);
  await axe(page, 'joke page');
  await mainNav(page, 'Jokes');
  // Screen readers hear the title, the joke and its details, as before.
  await expect(
    page.getByRole('link', { name: /Recliner.*Airports.*The guy next to me.*writing this from his lap/ }),
  ).toBeVisible();
  await axe(page, 'jokes list');
  await page.emulateMedia({ colorScheme: 'dark' });
  await axe(page, 'jokes list, dark');

  await page.emulateMedia({ colorScheme: 'light', forcedColors: 'active' });
  const card = page.getByRole('list', { name: '1 joke' }).getByRole('link');
  const edges = await card.evaluate((el) => ({
    edge: getComputedStyle(el).borderTopWidth,
    edgeStyle: getComputedStyle(el).borderTopStyle,
    red: getComputedStyle(el.querySelector('.index-card__head')!).borderBottomWidth,
  }));
  expect(edges).toEqual({ edge: '1px', edgeStyle: 'solid', red: '2px' });
});
