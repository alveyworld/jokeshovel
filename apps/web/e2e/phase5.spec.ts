import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { SETUP, addItems, createTopic, openSetup, signIn, stepLink, waitForSaved } from './helpers';

const PUNCH = 'So I did loop-de-loops on the tarmac.';
const mainNav = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name }).click();
const settings = (page: Page) =>
  page.getByRole('navigation', { name: 'Tools' }).getByRole('link', { name: 'Settings' }).click();

/** Topic "Airports" → setup → a finished joke; ends on the joke card. */
async function finishedJoke(page: Page) {
  await openSetup(page);
  await page.getByRole('button', { name: 'Start a joke attempt' }).click();
  await stepLink(page, 'Punch').click();
  await page.getByRole('textbox', { name: 'Punch' }).fill(PUNCH);
  await page.getByRole('link', { name: 'Next: Review' }).click();
  await page.getByRole('button', { name: 'Mark as complete' }).click();
  await expect(page).toHaveURL(/\/j\/[^/]+$/);
}

/** Clicks somewhere neutral so single-key shortcuts aren't typed into a field. */
const blur = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

test('the quick switcher jumps to topics, setups and screens (NAV-2)', async ({ page }) => {
  await signIn(page);
  await openSetup(page, 'Airports');
  await waitForSaved(page);
  await createTopic(page, 'Weddings');

  await page.keyboard.press('Control+k');
  const switcher = page.getByRole('dialog', { name: 'Quick switcher' });
  await expect(switcher).toBeVisible();
  const box = switcher.getByRole('combobox', { name: 'Jump to' });
  await expect(box).toBeFocused();
  await box.fill('airp');
  await expect(switcher.getByRole('option').first()).toContainText('Airports');
  await expect(switcher.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
  await box.press('Enter');
  await expect(page).toHaveURL(/\/topics\/[^/]+/);
  await expect(page.getByRole('textbox', { name: 'Topic title', exact: true })).toHaveValue('Airports');

  // Setups by their words, and screens by name, with the arrow keys.
  await page.getByRole('button', { name: 'Quick switcher' }).click();
  await box.fill('layover');
  await expect(switcher.getByRole('option', { name: /Setup.*six-hour layover/ })).toBeVisible();
  await box.fill('sett');
  await box.press('ArrowDown');
  await box.press('ArrowUp');
  await box.press('Enter');
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();

  // Esc closes; nothing matching offers a full search.
  await page.keyboard.press('Control+k');
  await box.fill('zzzz');
  await expect(switcher.getByRole('option')).toHaveCount(1);
  await expect(switcher.getByRole('option')).toContainText('Search everything for “zzzz”');
  await page.keyboard.press('Escape');
  await expect(switcher).toBeHidden();
});

test('keyboard shortcuts: help, N, /, [ ], ⌘Z, and they can be turned off (NAV-3)', async ({ page }) => {
  test.skip(test.info().project.name === 'mobile', 'keyboard shortcuts are for desktop');
  await signIn(page);
  await createTopic(page, 'Airports');
  await addItems(page, 'New association', ['layover', 'TSA']);

  // ⌘Z (outside text fields) undoes a delete.
  await page.getByRole('button', { name: 'Delete “TSA”' }).click();
  await expect(page.getByRole('list', { name: '1 associations' })).toBeVisible();
  await blur(page);
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('list', { name: '2 associations' })).toBeVisible();

  // "?" shows the help; N focuses the new-item box; typing "n" in a field just types.
  await blur(page);
  await page.keyboard.press('?');
  const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(help).toBeVisible();
  await expect(help.getByRole('row', { name: /Open the quick switcher/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('n');
  const input = page.getByRole('textbox', { name: 'New association', exact: true });
  await expect(input).toBeFocused();
  await page.keyboard.type('neck pillow');
  await expect(input).toHaveValue('neck pillow');

  // "/" opens Search.
  await blur(page);
  await page.keyboard.press('/');
  await expect(page.getByRole('heading', { name: /Search/, level: 1 })).toBeVisible();

  // "]" and "[" move through the Joke Mine.
  await openSetup(page, 'Dentists', 'My dentist has a waiting room with no chairs.');
  await page.getByRole('button', { name: 'Start a joke attempt' }).click();
  await expect(page).toHaveURL(/\/target$/);
  await expect(page.getByRole('link', { name: 'Next: Connector' })).toBeVisible();
  await blur(page);
  await page.keyboard.press(']');
  await expect(page).toHaveURL(/\/connector$/);
  await expect(page.getByRole('link', { name: 'Next: Reinterpret' })).toBeVisible();
  await blur(page);
  await page.keyboard.press('[');
  await expect(page).toHaveURL(/\/target$/);

  // Turned off: single keys do nothing, ⌘K still works (WCAG 2.1.4).
  await settings(page);
  await page.getByLabel('Single-key shortcuts').uncheck();
  await waitForSaved(page);
  await blur(page);
  await page.keyboard.press('?');
  await expect(help).toBeHidden();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Quick switcher' })).toBeVisible();
});

test('tags on jokes and topics, filters, rename and delete (ORG-1)', async ({ page }) => {
  await signIn(page);
  // Tagging a topic the moment it's created (it may still be in the save queue).
  await createTopic(page, 'Weddings');
  await page.getByRole('combobox', { name: 'Add a tag' }).fill('Family');
  await page.getByRole('button', { name: 'Add tag' }).click();
  await expect(page.getByRole('list', { name: 'Tags' })).toContainText('Family');

  await finishedJoke(page);

  const tags = page.getByRole('list', { name: 'Tags' });
  await page.getByRole('combobox', { name: 'Add a tag' }).fill('Opener, clean set, opener');
  await page.getByRole('button', { name: 'Add tag' }).click();
  await expect(tags.getByRole('listitem')).toHaveText([/clean set/, /Opener/]);
  await page.reload();
  await expect(page.getByRole('list', { name: 'Tags' }).getByRole('listitem')).toHaveCount(2);

  // A second joke without tags, then filter.
  await page.getByRole('link', { name: 'Airports' }).first().click();
  await page.getByRole('combobox', { name: 'Add a tag' }).fill('Travel');
  await page.getByRole('button', { name: 'Add tag' }).click();
  await expect(page.getByRole('list', { name: 'Tags' })).toContainText('Travel');
  await mainNav(page, 'Topics');
  await expect(page.getByRole('link', { name: /Airports/ })).toContainText('Travel');
  await page.getByLabel('Tag').selectOption({ label: 'Opener' });
  await expect(page.getByText('No topics here with that tag.')).toBeVisible();

  await mainNav(page, 'Jokes');
  await page.getByLabel('Tag').selectOption({ label: 'Opener' });
  await expect(page.getByRole('list', { name: '1 joke' })).toContainText('clean set · Opener');

  // Rename in Settings changes it everywhere; deleting removes it from the joke.
  await settings(page);
  const rename = page.getByRole('textbox', { name: 'Rename “clean set”' });
  await rename.fill('Clean');
  await rename.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Rename “Clean”' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete “Opener”' }).click();
  await page.getByRole('button', { name: 'Delete “Opener”' }).click();
  await expect(page.getByText('Deleted the tag “Opener”.')).toBeVisible();
  await mainNav(page, 'Jokes');
  await expect(page.getByRole('list', { name: '1 joke' })).toContainText('Clean');
  await expect(page.getByRole('list', { name: '1 joke' })).not.toContainText('Opener');
});

test('branch and duplicate a setup (SET-3)', async ({ page }) => {
  await signIn(page);
  await openSetup(page);
  await addItems(page, 'New assumption', ['The speaker is a passenger.', 'The layover was boring.']);
  await waitForSaved(page);
  const original = page.url();

  await page.getByRole('button', { name: 'Branch', exact: true }).click();
  await expect(page.getByText('Branched. Change the wording to try a variation.')).toBeVisible();
  expect(page.url()).not.toBe(original);
  await expect(page.getByRole('textbox', { name: 'Setup', exact: true })).toHaveValue(SETUP);
  await expect(page.getByText(/^Branch of/)).toContainText('My flight had a six-hour layover.');
  await expect(page.getByText('No assumptions yet.', { exact: false })).toBeVisible();

  await page.getByRole('link', { name: /“My flight had a six-hour layover\.”/ }).click();
  await expect(page).toHaveURL(original);
  await expect(page.getByText(/^Branch:/)).toBeVisible();

  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await expect(page.getByText('Duplicated, with its assumptions.')).toBeVisible();
  await expect(page.getByRole('list', { name: '2 assumptions' })).toBeVisible();
});

test('the Trash restores work and deletes it for good (ERR-3, ORG-2)', async ({ page }) => {
  await signIn(page);
  await finishedJoke(page);
  const jokeUrl = page.url();
  await createTopic(page, 'Weddings');
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/topics$/);
  await page.goto(jokeUrl);
  await page.getByRole('button', { name: 'Delete' }).click();
  await waitForSaved(page);

  await settings(page);
  await page.getByRole('link', { name: 'Open the Trash' }).click();
  const list = page.getByRole('list', { name: /in the Trash/ });
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list).toContainText('Topic · Everything in it comes back too');
  await expect(list).toContainText('gone for good in 30 days');

  await list.getByRole('button', { name: 'Restore “Weddings”' }).click();
  await expect(page.getByText('Restored “Weddings”.')).toBeVisible();
  await list.getByRole('button', { name: /Delete for good “Airports/ }).click();
  await list.getByRole('button', { name: 'Yes, delete for good' }).click();
  await expect(page.getByText('The Trash is empty.')).toBeVisible();
  await waitForSaved(page);
  await page.reload();
  await expect(page.getByText('The Trash is empty.')).toBeVisible();

  await mainNav(page, 'Topics');
  await expect(page.getByRole('link', { name: /Weddings/ })).toBeVisible();
  await mainNav(page, 'Jokes');
  await expect(page.getByText('No jokes yet.', { exact: false })).toBeVisible();
});

test('export to Markdown and JSON, and the JSON reads back (ORG-3)', async ({ page }) => {
  await signIn(page);
  await finishedJoke(page);
  await page.getByRole('combobox', { name: 'Add a tag' }).fill('Opener');
  await page.getByRole('button', { name: 'Add tag' }).click();
  await expect(page.getByRole('list', { name: 'Tags' })).toContainText('Opener');
  await settings(page);

  const [md] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Markdown' }).click(),
  ]);
  expect(md.suggestedFilename()).toMatch(/^jokeshovel-\d{4}-\d{2}-\d{2}\.md$/);
  const markdown = await readFile((await md.path())!, 'utf8');
  expect(markdown).toContain('## Airports');
  expect(markdown).toContain(`**${PUNCH}**`);
  expect(markdown).toContain('Tags: Opener');

  const [json] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download JSON' }).click(),
  ]);
  const file = JSON.parse(await readFile((await json.path())!, 'utf8'));
  expect(file).toMatchObject({ format: 'jokeshovel-export', version: 1 });
  expect(file.topics.map((t: { title: string }) => t.title)).toEqual(['Airports']);
  expect(file.jokes).toHaveLength(1);
  expect(file.jokes[0].punch_text).toBe(PUNCH);
  expect(file.tags.map((t: { name: string }) => t.name)).toEqual(['Opener']);
  expect(file.joke_tags).toEqual([{ joke_id: file.jokes[0].id, tag_id: file.tags[0].id }]);
  expect(JSON.stringify(file)).not.toContain('user_id');
});

test('deleting an account removes everything, after typing the phrase (FR-A4)', async ({ page }) => {
  const email = await signIn(page);
  await createTopic(page, 'Airports');
  await waitForSaved(page);
  await settings(page);
  await page.getByRole('button', { name: 'Delete account…' }).click();
  const confirm = page.getByRole('button', { name: 'Delete my account' });
  await expect(confirm).toBeDisabled();
  await page.getByLabel('Type delete my account to confirm').fill('delete my account');
  await confirm.click();
  await expect(page).toHaveURL(/\/signin\?deleted=1/);
  await expect(page.getByText('Your account and everything in it has been deleted.')).toBeVisible();

  // Signing in again with the same email starts a brand-new, empty account.
  await signIn(page, email);
  await expect(page.getByText('Every topic is a dig site.')).toBeVisible();
});

test('Expert mode, theme and reduced motion (EXP-1, A11Y-3)', async ({ page }) => {
  await signIn(page);
  await createTopic(page, 'Airports');
  const intro = page.locator('.workspace__intro').first();
  await expect(intro).toBeVisible();

  await settings(page);
  await page.getByLabel('Expert mode').check();
  await page.getByText('Dark', { exact: true }).click();
  await page.getByLabel('Reduce motion').check();
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(html).toHaveAttribute('data-expert', '');
  await expect(html).toHaveAttribute('data-reduce-motion', '');
  await waitForSaved(page);

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).not.toBe('rgb(243, 238, 138)');
  await mainNav(page, 'Topics');
  await page.getByRole('link', { name: /Airports/ }).click();
  await expect(page.locator('.workspace__intro').first()).toBeHidden();
});

test('swipe a topic card to reveal quick actions (touch)', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile', 'swipe actions are touch-only');
  await signIn(page);
  await createTopic(page, 'Airports');
  await waitForSaved(page);
  await mainNav(page, 'Topics');
  const card = page.getByRole('link', { name: /Airports/ });
  await expect(card).toBeVisible();

  const surface = page.locator('.swipe__content').first();
  const box = (await surface.boundingBox())!;
  const y = box.y + box.height / 2;
  await surface.evaluate(
    (el, { x, y }) => {
      const fire = (type: string, clientX: number) =>
        el.dispatchEvent(
          new PointerEvent(type, { pointerType: 'touch', pointerId: 7, clientX, clientY: y, bubbles: true }),
        );
      fire('pointerdown', x);
      for (let dx = 0; dx <= 260; dx += 20) fire('pointermove', x - dx);
      fire('pointerup', x - 260);
    },
    { x: box.x + box.width - 20, y },
  );

  await page.getByRole('button', { name: 'Favorite', exact: true }).click();
  await expect(card).toContainText('★');
});

test('no serious accessibility violations on Phase 5 screens', async ({ page }) => {
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
  await finishedJoke(page);
  await page.getByRole('combobox', { name: 'Add a tag' }).fill('Opener');
  await page.getByRole('button', { name: 'Add tag' }).click();
  await expect(page.getByRole('list', { name: 'Tags' })).toContainText('Opener');
  await check('joke card with tags');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Jump to' }).fill('air');
  await check('quick switcher');
  await page.keyboard.press('Escape');
  await blur(page);
  await page.keyboard.press('?');
  await check('shortcut help');
  await page.keyboard.press('Escape');
  await settings(page);
  await page.getByRole('button', { name: 'Delete account…' }).click();
  await check('settings');
  await page.getByText('Dark', { exact: true }).click();
  await check('settings, dark theme');
  await page.getByRole('link', { name: 'Open the Trash' }).click();
  await check('trash (empty)');
});

test('Phase 5 screens fit a 320px phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await signIn(page);
  await finishedJoke(page);
  await page.getByRole('combobox', { name: 'Add a tag' }).fill('A rather long tag name about sets');
  await page.getByRole('button', { name: 'Add tag' }).click();
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow(), 'joke card').toBeLessThanOrEqual(0);
  for (const path of ['/settings', '/trash', '/topics']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    expect(await overflow(), path).toBeLessThanOrEqual(0);
  }
  await page.getByRole('button', { name: 'Quick switcher' }).click();
  await expect(page.getByRole('dialog', { name: 'Quick switcher' })).toBeVisible();
  expect(await overflow(), 'switcher').toBeLessThanOrEqual(0);
});
