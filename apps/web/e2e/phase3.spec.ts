import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { SETUP, createTopic, openSetup, signIn, stepLink, waitForSaved } from './helpers';

const PUNCH = 'So I did loop-de-loops on the tarmac.';

const mainNav = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name }).click();

/** From a setup's Mine page: start an attempt, write a punch and open Review. */
async function digToReview(page: Page, punch = PUNCH) {
  await page.getByRole('button', { name: /Start (a joke|another) attempt/ }).click();
  await stepLink(page, 'Punch').click();
  await page.getByRole('textbox', { name: 'Punch' }).fill(punch);
  await page.getByRole('link', { name: 'Next: Review' }).click();
  await expect(page.getByRole('heading', { name: 'Review the joke' })).toBeVisible();
}

/** Marks the joke on the Review step complete and waits for its joke card. */
async function complete(page: Page, title?: string) {
  if (title) await page.getByRole('textbox', { name: 'Title' }).fill(title);
  await page.getByRole('button', { name: 'Mark as complete' }).click();
  await expect(page).toHaveURL(/\/j\/[^/]+$/);
}

async function noOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label} at 320px`).toBeLessThanOrEqual(0);
}

test('completing a joke: disabled until ready, one joke per attempt, edits stay on the card (AC-16, AC-17)', async ({
  page,
}) => {
  await signIn(page);
  await openSetup(page);
  await page.getByRole('button', { name: 'Start a joke attempt' }).click();

  // AC-16: disabled, with the reason, while the punch is empty.
  await stepLink(page, 'Review').click();
  const markComplete = page.getByRole('button', { name: 'Mark as complete' });
  await expect(markComplete).toBeDisabled();
  await expect(page.getByText('Write a punch first')).toBeVisible();
  await page.getByRole('link', { name: 'go to the punch' }).click();
  await page.getByRole('textbox', { name: 'Punch' }).fill(PUNCH);
  await page.getByRole('link', { name: 'Next: Review' }).click();

  // The title is suggested from the topic and the setup's key words.
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue(/^Airports — \S+ \S+$/);
  await page.getByRole('textbox', { name: 'Title' }).fill('Pilot layover');

  // A double-click (or a retry) still makes exactly one joke.
  await markComplete.dblclick();
  await expect(page).toHaveURL(/\/j\/[^/]+$/);
  await expect(page.getByText('Nugget! “Pilot layover” is in your jokes.')).toBeVisible();
  const jokeUrl = page.url();

  await mainNav(page, 'Jokes');
  await expect(page.getByRole('list', { name: '1 joke' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Pilot layover/ })).toContainText(PUNCH);

  // A completed attempt leaves Drafts.
  await mainNav(page, 'Drafts');
  await expect(page.getByText('No unfinished jokes.')).toBeVisible();

  // AC-17: editing the joke card's punch doesn't rewrite the dig.
  await page.goto(jokeUrl);
  await page.getByRole('textbox', { name: 'Punch' }).fill('Loop-de-loops. On the tarmac.');
  await waitForSaved(page);
  await page.getByText('How you dug it').click();
  await page.getByRole('link', { name: 'Open the dig' }).click();
  await expect(page.getByRole('heading', { name: 'Review the joke' })).toBeVisible();
  await expect(page.locator('.joke-card__punchline')).toHaveText(PUNCH);
  await expect(page.getByText('This joke is complete.')).toBeVisible();
  await page.getByRole('link', { name: 'Open the joke card' }).click();
  await expect(page.getByRole('textbox', { name: 'Punch' })).toHaveValue('Loop-de-loops. On the tarmac.');
});

test('favorites and ratings persist, and the Favorites filter shows only favorites (AC-20)', async ({ page }) => {
  await signIn(page);
  await openSetup(page);
  await digToReview(page);
  await complete(page, 'Pilot layover');

  await page.getByRole('button', { name: 'Favorite joke' }).click();
  await page.locator('label').filter({ hasText: '4 stars' }).click();
  await expect(page.getByRole('radio', { name: '4 stars' })).toBeChecked();
  await waitForSaved(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Favorite joke' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('radio', { name: '4 stars' })).toBeChecked();

  // A second, unfavorited joke from the same setup.
  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Jokes' }).click();
  await page.goBack();
  await page.getByRole('link', { name: 'Airports' }).click();
  await page.getByRole('link', { name: /Setups/ }).click();
  await page.getByRole('link', { name: 'Mine this setup — Setup 1' }).click();
  await digToReview(page, 'Turns out the gate was a carousel.');
  await complete(page, 'Carousel');

  await mainNav(page, 'Jokes');
  await expect(page.getByRole('list', { name: '2 jokes' })).toBeVisible();
  await page.getByText('Favorites', { exact: true }).click();
  await expect(page.getByRole('list', { name: '1 joke' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Pilot layover/ })).toContainText('Rated 4 of 5');
  await expect(page.getByRole('link', { name: /Carousel/ })).toHaveCount(0);

  // Rating filter and archive.
  await page.getByText('All', { exact: true }).click();
  await page.getByLabel('Rating').selectOption('4');
  await expect(page.getByRole('list', { name: '1 joke' })).toBeVisible();
  await page.getByLabel('Rating').selectOption('0');
  await page.getByRole('link', { name: /Carousel/ }).click();
  await page.getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText('This joke is archived.')).toBeVisible();
  await mainNav(page, 'Jokes');
  await expect(page.getByRole('list', { name: '1 joke' })).toBeVisible();
  await page.getByText('Archived', { exact: true }).click();
  await expect(page.getByRole('link', { name: /Carousel/ })).toBeVisible();
});

test('search finds near-misses, grouped by type (AC-18)', async ({ page }) => {
  await signIn(page);
  await openSetup(page);
  await digToReview(page);
  await complete(page, 'Pilot layover');

  await page.getByRole('navigation', { name: 'Tools' }).getByRole('link', { name: 'Search' }).click();
  await page.getByRole('searchbox', { name: 'Search your material' }).fill('layovr');
  await expect(page.getByRole('status').filter({ hasText: 'for “layovr”' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Jokes/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Setups/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Pilot layover/ })).toBeVisible();

  // Filter to one type; the URL keeps the search across a reload.
  await page.getByRole('radio', { name: /^Setups \d+$/ }).check();
  await expect(page.getByRole('heading', { name: /^Jokes/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('searchbox', { name: 'Search your material' })).toHaveValue('layovr');
  await page.getByRole('link', { name: /Pilot layover/ }).click();
  await expect(page.getByRole('textbox', { name: 'Punch' })).toHaveValue(PUNCH);

  await page.goto('/search?q=zzzzqqq');
  await expect(page.getByText('Nothing matches “zzzzqqq”.')).toBeVisible();
});

test('completion % and stats match the work done (AC-19, STAT-2, STAT-3)', async ({ page }) => {
  await signIn(page);
  await createTopic(page, 'Empty topic');
  await expect(page.getByText('Completion —')).toBeVisible();

  await openSetup(page);
  await digToReview(page);
  await complete(page, 'Pilot layover');
  await page.getByRole('link', { name: 'Airports' }).click();
  await expect(page.getByText('Completion 100%')).toBeVisible();
  await page.getByRole('link', { name: /Setups/ }).click();
  await page.getByRole('button', { name: '+ New setup' }).click();
  await page.getByRole('textbox', { name: 'Setup 2', exact: true }).fill('Security took my shampoo.');
  await waitForSaved(page);
  await page.reload();
  await expect(page.getByText('Completion 50%')).toBeVisible();

  // The topic's Jokes tab.
  await page.getByRole('link', { name: /^Jokes \d/ }).click();
  await expect(page.getByRole('list', { name: '1 joke' })).toBeVisible();

  await mainNav(page, 'Home');
  await page.getByRole('link', { name: 'See stats' }).click();
  await expect(page.getByRole('heading', { name: /Stats/, level: 1 })).toBeVisible();
  const tile = (label: string) => page.locator('.tile').filter({ has: page.getByText(label, { exact: true }) });
  await expect(tile('Setups').locator('dd')).toHaveText('2');
  await expect(tile('Completed jokes').locator('dd')).toHaveText('1');
  await expect(tile('Completion').locator('dd')).toHaveText('50%');

  const table = page.locator('.stats-table');
  await expect(table.getByRole('row', { name: /Airports/ })).toContainText('50%');
  await expect(table.getByRole('row', { name: /Empty topic/ })).toContainText('—');

  // Weekly chart: keyboard readout and table view.
  const chart = page.getByRole('figure', { name: 'Jokes completed' });
  await expect(chart).toContainText('1 this week');
  await chart.getByRole('group', { name: /^Jokes completed/ }).focus();
  await page.keyboard.press('End');
  await expect(chart.locator('[aria-live]')).toHaveText(/: 1 joke$/);
  await chart.getByText('Show as table').click();
  await expect(chart.getByRole('row').last()).toContainText('1');
});

test('no serious accessibility violations on Phase 3 screens', async ({ page }) => {
  test.skip(test.info().project.name === 'mobile', 'sticky-footer false positive; see sprint1.spec.ts');
  const check = async (label: string) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      serious.map((v) => `${label}: ${v.id} — ${v.help} @ ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    ).toEqual([]);
  };
  await signIn(page);
  await openSetup(page);
  await digToReview(page);
  await check('review');
  await complete(page, 'Pilot layover');
  await page.locator('label').filter({ hasText: '4 stars' }).click();
  await page.getByText('How you dug it').click();
  await check('joke detail');
  await mainNav(page, 'Jokes');
  await check('jokes list');
  await page.goto('/search?q=layovr');
  await expect(page.getByRole('heading', { name: /^Jokes/ })).toBeVisible();
  await check('search');
  await page.goto('/stats');
  await expect(page.getByRole('heading', { name: /Stats/, level: 1 })).toBeVisible();
  await page.getByRole('figure', { name: 'Setups written' }).getByText('Show as table').click();
  await check('stats');
  await mainNav(page, 'Home');
  await check('home with haul');
});

test('Phase 3 screens fit a 320px phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await signIn(page);
  await openSetup(page, 'A really quite long topic title about airports', SETUP);
  await digToReview(page, 'So I did loop-de-loops on the tarmac until the tower called my mother about it.');
  await noOverflow(page, 'review');
  await complete(page);
  await noOverflow(page, 'joke detail');
  for (const path of ['/jokes', '/search?q=layover', '/stats']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    await noOverflow(page, path);
  }
});
