import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { topicTitleFromText } from '../src/lib/text';
import { addItems, createTopic, signIn, waitForSaved } from './helpers';

// ASSOC-5: turn an association into its own topic (docs/DESIGN.md AC-28 to AC-34).

const title = (page: Page) => page.getByRole('textbox', { name: 'Topic title' });
const makeButton = (page: Page, text: string) => page.getByRole('button', { name: `Make “${text}” a topic` });
const openLink = (page: Page, text: string) => page.getByRole('link', { name: `Open topic “${text}”` });

async function topicsNamed(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Topics' }).click();
  await expect(page.getByRole('heading', { name: 'Topics', level: 1 })).toBeVisible();
  return page.getByRole('list', { name: /topics$/ }).getByRole('link', { name: new RegExp(`^${name}\\b`) });
}

test('an association becomes its own topic, linked both ways (AC-28, AC-29)', async ({ page }) => {
  await signIn(page);
  await createTopic(page, 'Airports');
  await addItems(page, 'New association', ['TSA', 'layover']);
  await waitForSaved(page);
  const airports = page.url();

  await makeButton(page, 'TSA').click();
  await expect(title(page)).toHaveValue('TSA');
  await expect(page).toHaveURL(/\/topics\/[0-9a-f-]+\/associations$/);
  expect(page.url()).not.toBe(airports);
  await expect(page.getByLabel('New association')).toBeFocused();
  await expect(page.getByText('Nothing here yet.')).toBeVisible();
  await expect(page.getByRole('link', { name: '“TSA” in Airports' })).toBeVisible();
  await addItems(page, 'New association', ['shoes off']);
  await waitForSaved(page);
  const tsa = page.url();

  // Back returns to Airports, which keeps the association and its count.
  await page.goBack();
  await expect(page).toHaveURL(airports);
  await expect(title(page)).toHaveValue('Airports');
  await expect(page.getByRole('list', { name: '2 associations' })).toBeVisible();
  await expect(openLink(page, 'TSA')).toBeVisible();
  await expect(makeButton(page, 'layover')).toBeVisible();

  // Both links survive a reload (they're saved, not just on this device).
  await page.reload();
  await openLink(page, 'TSA').click();
  await expect(page).toHaveURL(tsa);
  await expect(page.getByRole('list', { name: '1 associations' })).toBeVisible();
  await page.getByRole('link', { name: '“TSA” in Airports' }).click();
  await expect(page).toHaveURL(airports);
});

test('an association only ever becomes one topic (AC-30)', async ({ page }) => {
  await signIn(page);
  await createTopic(page, 'Gyms');
  await addItems(page, 'New association', ['treadmill', 'protein shake']);
  await waitForSaved(page);

  await makeButton(page, 'treadmill').click();
  await expect(title(page)).toHaveValue('treadmill');
  const treadmill = page.url();
  await page.goBack();
  await openLink(page, 'treadmill').click();
  await expect(page).toHaveURL(treadmill);

  // Two taps that both land before the screen updates.
  await page.goBack();
  await makeButton(page, 'protein shake').evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(title(page)).toHaveValue('protein shake');
  await waitForSaved(page);
  await expect(await topicsNamed(page, 'protein shake')).toHaveCount(1);
  await expect(await topicsNamed(page, 'treadmill')).toHaveCount(1);
});

test('a matching title asks first; long text is cut at a whole word (AC-31)', async ({ page }) => {
  await signIn(page);
  await createTopic(page, 'Dogs');
  await createTopic(page, 'Pets');
  const long =
    'the neighbour’s dog who barks at every delivery driver, every cyclist, every leaf and, as far as I can tell, the moon itself';
  await addItems(page, 'New association', ['dogs', long]);
  await waitForSaved(page);
  const pets = page.url();

  // "Open" goes to the topic that's already there.
  await makeButton(page, 'dogs').click();
  const dialog = page.getByRole('dialog', { name: 'You already have this topic' });
  await expect(dialog).toContainText('You already have a topic called “Dogs”.');
  await expect(dialog.getByRole('button', { name: 'Open “Dogs”' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Open “Dogs”' }).click();
  await expect(title(page)).toHaveValue('Dogs');
  await expect(page.getByText(/^Made from /)).toHaveCount(0);

  // Closing changes nothing; "Create another" makes a linked topic anyway.
  await page.goto(pets);
  await makeButton(page, 'dogs').click();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(pets);
  await makeButton(page, 'dogs').click();
  await dialog.getByRole('button', { name: 'Create another' }).click();
  await expect(title(page)).toHaveValue('dogs');
  await expect(page.getByRole('link', { name: '“dogs” in Pets' })).toBeVisible();

  // An association longer than a topic title allows.
  await page.goto(pets);
  await makeButton(page, long).click();
  const expected = topicTitleFromText(long, 120);
  expect(expected.length).toBeLessThanOrEqual(120);
  expect(long.startsWith(`${expected} `) || long.startsWith(`${expected},`)).toBe(true);
  await expect(title(page)).toHaveValue(expected);
});

test('works offline and syncs on reconnect (AC-32)', async ({ page, context }) => {
  await signIn(page);
  await createTopic(page, 'Subways');
  await addItems(page, 'New association', ['turnstile']);
  await waitForSaved(page);

  await context.setOffline(true);
  await makeButton(page, 'turnstile').click();
  await expect(title(page)).toHaveValue('turnstile');
  await addItems(page, 'New association', ['MetroCard']);
  await expect(page.locator('.save-indicator')).toContainText('Offline — saved on this device', { timeout: 10_000 });

  await context.setOffline(false);
  await waitForSaved(page);
  await page.reload();
  await expect(title(page)).toHaveValue('turnstile');
  await expect(page.getByRole('textbox', { name: 'Association 1', exact: true })).toHaveValue('MetroCard');
  await expect(page.getByRole('link', { name: '“turnstile” in Subways' })).toBeVisible();
});

test('deleting either side removes the link and keeps the other (AC-33)', async ({ page }) => {
  await signIn(page);
  await createTopic(page, 'Weddings');
  await addItems(page, 'New association', ['open bar', 'DJ']);
  await waitForSaved(page);
  const weddings = page.url();

  // Trashing the new topic unlinks the association; restoring links it again.
  await makeButton(page, 'open bar').click();
  await expect(title(page)).toHaveValue('open bar');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/topics$/);
  await waitForSaved(page);
  await page.goto(weddings);
  await expect(makeButton(page, 'open bar')).toBeVisible();

  await page.getByRole('navigation', { name: 'Tools' }).getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: 'Open the Trash' }).click();
  await page.getByRole('button', { name: 'Restore “open bar”' }).click();
  await expect(page.getByText('Restored “open bar”.')).toBeVisible();
  await waitForSaved(page);
  await page.goto(weddings);
  await expect(openLink(page, 'open bar')).toBeVisible();

  // Deleting the association keeps the topic and drops its "From" line.
  await page.getByRole('button', { name: 'Delete “open bar”' }).click();
  await expect(page.getByRole('list', { name: '1 associations' })).toBeVisible();
  await waitForSaved(page);
  await (await topicsNamed(page, 'open bar')).click();
  await expect(title(page)).toHaveValue('open bar');
  await expect(page.getByText(/^Made from /)).toHaveCount(0);
});

test('no serious accessibility violations (AC-X1)', async ({ page }) => {
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
  await createTopic(page, 'Cats');
  await createTopic(page, 'Pets');
  await addItems(page, 'New association', ['cats', 'vets']);
  await makeButton(page, 'vets').click();
  await expect(title(page)).toHaveValue('vets');
  await check('topic made from an association');
  await page.goBack();
  await expect(openLink(page, 'vets')).toBeVisible();
  await check('associations with a linked topic');
  await makeButton(page, 'cats').click();
  await expect(page.getByRole('dialog', { name: 'You already have this topic' })).toBeVisible();
  await check('same-title dialog');
});
