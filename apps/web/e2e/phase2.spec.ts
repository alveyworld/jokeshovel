import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { SETUP, addItems, next, openSetup, signIn, stepLink, waitForSaved } from './helpers';

test('golden path: setup → assumptions → target → connector → reinterpretations → punch (AC-9, AC-11, AC-13, AC-14)', async ({
  page,
}) => {
  await signIn(page);
  await openSetup(page);

  // AC-9: assumptions are listed on the setup.
  await addItems(page, 'New assumption', ['The speaker is a passenger.', 'The layover was boring.']);
  await expect(page.getByRole('list', { name: '2 assumptions' })).toBeVisible();

  await page.getByRole('button', { name: 'Start a joke attempt' }).click();
  await expect(page).toHaveURL(/\/a\/[^/]+\/target$/);
  await expect(page.getByRole('heading', { name: 'Choose a target assumption' })).toBeVisible();
  await page.getByRole('radio', { name: 'The speaker is a passenger.' }).check();

  // AC-11: word chips fill the connector in setup order.
  await next(page, 'Connector');
  const words = page.getByRole('group', { name: 'Words in your setup' });
  await words.getByRole('button', { name: 'flight', exact: true }).click();
  await words.getByRole('button', { name: 'My', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Connector', exact: true })).toHaveValue('My flight');
  await expect(words.getByRole('button', { name: 'My', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await words.getByRole('button', { name: 'My', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Connector', exact: true })).toHaveValue('flight');
  await words.getByRole('button', { name: 'My', exact: true }).click();

  await next(page, 'Reinterpret');
  await expect(page.getByText('What else could “My flight” mean?')).toBeVisible();
  await addItems(page, 'New reinterpretation', ['the flight I’m piloting', 'a flight of stairs', 'my escape']);
  await expect(page.getByRole('list', { name: '3 reinterpretations' })).toBeVisible();

  await next(page, 'Choose');
  await page.getByRole('radio', { name: 'the flight I’m piloting' }).check();

  await next(page, 'Second story');
  await page.getByRole('textbox', { name: 'Second story' }).fill('I’m the pilot, stuck waiting with a full tank.');

  await next(page, 'Punch');
  await expect(page.getByText(SETUP).first()).toBeVisible();
  await page.getByRole('textbox', { name: 'Punch' }).fill('So I did loop-de-loops on the tarmac.');
  await expect(page.getByText('7 words')).toBeVisible();
  await waitForSaved(page);

  // Everything survives a reload; the stepper shows finished steps as done.
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Punch' })).toHaveValue('So I did loop-de-loops on the tarmac.');
  await expect(stepLink(page, 'Target')).toContainText('done');
  await expect(stepLink(page, 'Choose')).toContainText('done');

  // AC-13: jump back to any step, then Back returns with the text intact.
  await stepLink(page, 'Target').click();
  await expect(page.getByRole('radio', { name: 'The speaker is a passenger.' })).toBeChecked();
  await page.goBack();
  await expect(page.getByRole('textbox', { name: 'Punch' })).toHaveValue('So I did loop-de-loops on the tarmac.');

  // AC-14: the attempt is listed under Drafts with its step.
  await waitForSaved(page);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Drafts' }).click();
  const draft = page.getByRole('link', { name: /My flight had a six-hour layover/ });
  await expect(draft).toContainText('Airports');
  await expect(draft).toContainText('Target: The speaker is a passenger.');
  await expect(draft).toContainText('Step 11 · Punch');
  await draft.click();
  await expect(page).toHaveURL(/\/punch$/);
});

test('changing the chosen reinterpretation flags the second story but changes no text (AC-12)', async ({ page }) => {
  await signIn(page);
  await openSetup(page);
  await page.getByRole('button', { name: 'Start a joke attempt' }).click();
  await stepLink(page, 'Reinterpret').click();
  await addItems(page, 'New reinterpretation', ['option one', 'option two']);
  await stepLink(page, 'Choose').click();
  await page.getByRole('radio', { name: 'option one' }).check();
  await stepLink(page, 'Second story').click();
  await page.getByRole('textbox', { name: 'Second story' }).fill('The story for option one.');
  await stepLink(page, 'Choose').click();
  await page.getByRole('radio', { name: 'option two' }).check();
  await expect(page.getByText('Your second story was written for “option one”.')).toBeVisible();
  await page.getByRole('link', { name: 'Review it?' }).click();
  await expect(page.getByRole('textbox', { name: 'Second story' })).toHaveValue('The story for option one.');
});

test('deleting the targeted assumption clears the target; a second attempt starts fresh (AC-10, AC-15)', async ({
  page,
}) => {
  await signIn(page);
  await openSetup(page);
  await addItems(page, 'New assumption', ['The speaker is a passenger.']);
  await page.getByRole('button', { name: 'Start a joke attempt' }).click();
  await page.getByRole('radio', { name: 'The speaker is a passenger.' }).check();
  await expect(stepLink(page, 'Target')).toContainText('current step');
  await waitForSaved(page);

  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Setup' }).click();
  await page.getByRole('button', { name: 'Delete “The speaker is a passenger.”' }).click();
  await page.getByRole('button', { name: 'Start another attempt' }).click();
  await expect(page.getByText('This setup has no assumptions yet.')).toBeVisible();

  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Setup' }).click();
  const attempts = page.getByRole('list', { name: '2 joke attempts' });
  await expect(attempts).toBeVisible();
  await expect(attempts.getByText('No target chosen yet')).toHaveCount(2);
});

test('a target chosen offline from a brand-new assumption is saved on reconnect', async ({ page, context }) => {
  await signIn(page);
  await openSetup(page);
  await page.getByRole('button', { name: 'Start a joke attempt' }).click();
  await expect(page.getByRole('heading', { name: 'Choose a target assumption' })).toBeVisible();
  await waitForSaved(page);

  await context.setOffline(true);
  // Visiting another step queues an edit to the attempt before the assumption exists.
  await stepLink(page, 'Connector').click();
  await stepLink(page, 'Target').click();
  await page.getByRole('textbox', { name: 'Add an assumption' }).fill('The flight was cancelled.');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'The flight was cancelled.' })).toBeChecked();

  await context.setOffline(false);
  await waitForSaved(page);
  await page.reload();
  await expect(page.getByRole('radio', { name: 'The flight was cancelled.' })).toBeChecked();
});

test('Joke Mine screens have no serious accessibility violations and fit 320px (AC-X1, AC-X3)', async ({ page }) => {
  test.skip(test.info().project.name === 'mobile', 'axe runs on the desktop layout; see sprint1.spec.ts');
  const check = async (label: string) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${label}: ${v.id} @ ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  };
  await signIn(page);
  await openSetup(page);
  await addItems(page, 'New assumption', ['The speaker is a passenger.']);
  await check('setup detail');
  await page.getByRole('button', { name: 'Start a joke attempt' }).click();
  await page.getByRole('radio', { name: 'The speaker is a passenger.' }).check();
  await check('target');
  for (const label of ['Connector', 'Reinterpret', 'Choose', 'Second story', 'Punch']) {
    await stepLink(page, label).click();
    await check(label);
  }
  const attemptBase = page.url().replace(/\/[a-z_]+$/, '');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Drafts' }).click();
  await check('drafts');

  await page.setViewportSize({ width: 320, height: 640 });
  for (const step of ['target', 'connector', 'punch']) {
    await page.goto(`${attemptBase}/${step}`);
    await expect(page.getByRole('navigation', { name: 'Joke Mine steps' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${step} at 320px`).toBeLessThanOrEqual(0);
  }
});
