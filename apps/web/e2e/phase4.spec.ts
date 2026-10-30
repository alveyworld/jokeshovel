import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { addItems, createTopic, signIn, stepLink, waitForSaved } from './helpers';

const SETUP = 'My flight had a six-hour layover.';
const PUNCH = 'So I did loop-de-loops on the tarmac.';

/**
 * The design's fixture (AC-21): topic "Airports", association "layover",
 * connector "my flight". Ends on the finished joke's card.
 */
async function fixtureJoke(page: Page) {
  await signIn(page);
  await createTopic(page, 'Airports');
  await addItems(page, 'New association', ['layover']);
  await page.getByRole('link', { name: /Setups/ }).click();
  await page.getByRole('button', { name: '+ New setup' }).click();
  await page.getByRole('textbox', { name: 'Setup 1', exact: true }).fill(SETUP);
  await page.getByRole('link', { name: 'Mine this setup — Setup 1' }).click();
  await page.getByRole('button', { name: 'Start a joke attempt' }).click();
  await stepLink(page, 'Connector').click();
  await page.getByRole('textbox', { name: 'Connector', exact: true }).fill('my flight');
  await stepLink(page, 'Punch').click();
  await page.getByRole('textbox', { name: 'Punch' }).fill(PUNCH);
  await page.getByRole('link', { name: 'Next: Review' }).click();
  await page.getByRole('button', { name: 'Mark as complete' }).click();
  await expect(page).toHaveURL(/\/j\/[^/]+$/);
}

/** Stands in for the phone's share sheet: records what was shared, or acts cancelled. */
async function fakeShareSheet(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: ShareData[]; __shareMode: 'ok' | 'abort' };
    w.__shared = [];
    w.__shareMode = 'ok';
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        w.__shared.push(data);
        if (w.__shareMode === 'abort') throw new DOMException('Share canceled', 'AbortError');
      },
    });
  });
}

const sheet = (page: Page) => page.getByRole('dialog', { name: 'Publish to Google Keep' });
const openSheet = async (page: Page) => {
  await page.getByRole('button', { name: 'Publish to Keep' }).click();
  await expect(sheet(page)).toBeVisible();
};

test('the note title comes from the topic and keyword chips, and can be edited (AC-21, AC-22, AC-24)', async ({
  page,
}) => {
  await fixtureJoke(page);
  await openSheet(page);
  const title = sheet(page).getByRole('textbox', { name: 'Note title' });
  const chip = (word: string) =>
    sheet(page).getByRole('group', { name: 'Keywords' }).getByRole('button', { name: word });

  // AC-21: flight 4, layover 3, six-hour 1 → the top two, in setup order.
  await expect(title).toHaveValue('Airports — Flight Layover — Joke');
  await expect(chip('Flight')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip('Six-Hour')).toHaveAttribute('aria-pressed', 'false');
  await chip('Six-Hour').click();
  await expect(title).toHaveValue('Airports — Flight Six-Hour Layover — Joke');

  // AC-22: a hand-edited title stops following the chips until reset.
  await title.fill('My pilot bit — Joke');
  await chip('Flight').click();
  await expect(title).toHaveValue('My pilot bit — Joke');
  await sheet(page).getByRole('button', { name: '↺ Reset to suggestion' }).click();
  await expect(title).toHaveValue('Airports — Six-Hour Layover — Joke');

  // AC-24: the preview holds exactly the checked sections, then the date and link.
  const preview = sheet(page).locator('.note-preview__body');
  await expect(preview).toContainText(`${SETUP}\n${PUNCH}`);
  await expect(preview).not.toContainText('How I dug it');
  await expect(preview).toContainText(/Topic: Airports · Written \w{3} \d{1,2}, \d{4}/);
  const jokeUrl = new URL(page.url());
  await expect(preview).toContainText(`Open in The Joke Shovel: ${jokeUrl.origin}${jokeUrl.pathname}`);

  await sheet(page).getByLabel('Connector and reinterpretation').check();
  await expect(preview).toContainText('— How I dug it —\nConnector: “my flight”');
  await sheet(page).getByLabel('Date and link back').uncheck();
  await expect(preview).not.toContainText('Open in The Joke Shovel');

  await page.keyboard.press('Escape');
  await expect(sheet(page)).toBeHidden();
});

test('Share to Keep: confirmed shares count, cancelled ones don’t (AC-23, AC-25)', async ({ page }) => {
  await fakeShareSheet(page);
  await fixtureJoke(page);
  const jokeUrl = page.url();

  await openSheet(page);
  await sheet(page).getByRole('button', { name: 'Share to Keep' }).click();
  await expect(sheet(page).getByText('Did it save in Keep?')).toBeVisible();
  const shared = await page.evaluate(() => (window as unknown as { __shared: ShareData[] }).__shared);
  expect(shared).toHaveLength(1);
  expect(shared[0].title).toBe('Airports — Flight Layover — Joke');
  expect(shared[0].text).toContain(`${SETUP}\n${PUNCH}`);

  await sheet(page).getByRole('button', { name: 'Yes, it’s in Keep' }).click();
  await expect(page.getByText('Sent to Keep.')).toBeVisible();
  await expect(page.locator('.publish-bar')).toContainText('Sent to Keep ·');

  // AC-25: the history lists method, status and time.
  const history = page.getByRole('list', { name: 'Publish history' });
  await expect(history.getByRole('listitem')).toHaveCount(1);
  await expect(history).toContainText('Keep · share sheet');
  await expect(history).toContainText('Saved in Keep');
  await expect(history.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T/);

  // AC-23: the topic's Keep count goes up by one.
  await page.getByRole('link', { name: 'Airports' }).first().click();
  await expect(page.getByText('1 sent to Keep')).toBeVisible();

  // Cancelling the share sheet records "Not saved" and leaves the count alone.
  await page.goto(jokeUrl);
  await page.evaluate(() => {
    (window as unknown as { __shareMode: string }).__shareMode = 'abort';
  });
  await openSheet(page);
  await sheet(page).getByRole('button', { name: 'Share to Keep' }).click();
  await expect(history.getByRole('listitem')).toHaveCount(2);
  await expect(sheet(page).getByRole('button', { name: 'Share to Keep' })).toBeEnabled();
  await expect(sheet(page).getByText('Did it save in Keep?')).toBeHidden();
  await sheet(page).getByRole('button', { name: 'Close' }).click();
  await expect(history.getByRole('listitem').first()).toContainText('Not saved');
  await page.getByRole('link', { name: 'Airports' }).first().click();
  await expect(page.getByText('1 sent to Keep')).toBeVisible();

  // The Jokes tab can show what's in Keep and what isn't.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Jokes' }).click();
  await page.getByLabel('Keep').selectOption('not');
  await expect(page.getByText('No jokes match these filters.')).toBeVisible();
  await page.getByLabel('Keep').selectOption('sent');
  await expect(page.getByRole('list', { name: '1 joke' })).toContainText('In Keep');
});

test('Copy & open Keep copies the note; an unanswered publish can be confirmed later', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only in Playwright');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await context.route('https://keep.google.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Keep</title>' }),
  );
  await fixtureJoke(page);

  await openSheet(page);
  await expect(sheet(page).getByRole('button', { name: 'Share to Keep' })).toHaveCount(0);
  await sheet(page).getByRole('button', { name: 'Copy & open Keep' }).click();
  await expect(sheet(page).getByText(/^Copied\./)).toBeVisible();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard.startsWith(`Airports — Flight Layover — Joke\n\n${SETUP}\n${PUNCH}`)).toBe(true);
  await expect(sheet(page).getByRole('link', { name: /Open Google Keep/ })).toHaveAttribute(
    'href',
    'https://keep.google.com/',
  );

  // Close without answering: the history asks later.
  await sheet(page).getByRole('button', { name: 'Close' }).click();
  const history = page.getByRole('list', { name: 'Publish history' });
  await expect(history).toContainText('Not confirmed');
  await history.getByRole('button', { name: 'It saved' }).click();
  await expect(history).toContainText('Saved in Keep');
  await expect(page.locator('.publish-bar')).toContainText('Sent to Keep ·');
  await waitForSaved(page);
  await page.reload();
  await expect(page.getByRole('list', { name: 'Publish history' })).toContainText('Keep · copy and open');
});

test('publishing waits for a connection', async ({ page, context }) => {
  await fixtureJoke(page);
  await waitForSaved(page);
  await context.setOffline(true);
  await openSheet(page);
  await expect(sheet(page).getByText('You’re offline. Publishing will be available when you reconnect.')).toBeVisible();
  await expect(sheet(page).getByRole('button', { name: 'Copy & open Keep' })).toBeDisabled();
  await context.setOffline(false);
  await expect(sheet(page).getByRole('button', { name: 'Copy & open Keep' })).toBeEnabled();
});

test('Settings explains Keep publishing; the Docs Joke Book stays hidden while it is switched off', async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole('navigation', { name: 'Tools' }).getByRole('link', { name: 'Settings' }).click();
  const integrations = page.getByRole('region', { name: 'Integrations' });
  await expect(integrations.getByRole('heading', { name: 'Google Keep' })).toBeVisible();
  await expect(integrations.getByRole('heading', { name: 'Google Docs Joke Book' })).toHaveCount(0);
});

test('no serious accessibility violations on Phase 4 screens', async ({ page }) => {
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
  await fakeShareSheet(page);
  await fixtureJoke(page);
  await openSheet(page);
  await sheet(page).getByLabel('Connector and reinterpretation').check();
  await check('publish sheet');
  await sheet(page).getByRole('button', { name: 'Share to Keep' }).click();
  await expect(sheet(page).getByText('Did it save in Keep?')).toBeVisible();
  await check('publish confirm');
  await sheet(page).getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('list', { name: 'Publish history' })).toContainText('Not confirmed');
  await check('joke card with history');
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible();
  await check('settings');
});

test('the Publish sheet fits a 320px phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await fixtureJoke(page);
  await openSheet(page);
  await sheet(page).getByLabel('Second story').check();
  const overflow = await page.evaluate(() => {
    const dialog = document.querySelector('dialog')!;
    return {
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sheet: dialog.scrollWidth - dialog.clientWidth,
      right: dialog.getBoundingClientRect().right - window.innerWidth,
    };
  });
  expect(overflow.page).toBeLessThanOrEqual(0);
  expect(overflow.sheet).toBeLessThanOrEqual(0);
  expect(overflow.right).toBeLessThanOrEqual(0);
});
