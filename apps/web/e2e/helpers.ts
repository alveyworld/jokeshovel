import { expect, type Page } from '@playwright/test';

export function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** Signs in (creating the account) with the dev-only email form. */
export async function signIn(page: Page, email = uniqueEmail()) {
  await page.goto('/signin');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Sign in with email' }).click();
  await expect(page.getByRole('heading', { name: /The Dig Site/ })).toBeVisible();
  return email;
}

export async function createTopic(page: Page, title: string) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Topics' }).click();
  await expect(page.getByRole('heading', { name: 'Topics', level: 1 })).toBeVisible();
  await page.getByRole('textbox', { name: 'New topic' }).fill(title);
  await page.getByRole('button', { name: 'Start digging' }).click();
  await expect(page.getByLabel('New association')).toBeFocused();
}

export async function waitForSaved(page: Page) {
  await expect(page.locator('.save-indicator')).toHaveClass(/save-indicator--saved/, { timeout: 10_000 });
}

export const SETUP = 'My flight had a six-hour layover.';

/** Topic → one setup → the setup's Mine page. */
export async function openSetup(page: Page, topic = 'Airports', setup = SETUP) {
  await createTopic(page, topic);
  await page.getByRole('link', { name: /Setups/ }).click();
  await page.getByRole('button', { name: '+ New setup' }).click();
  await page.getByRole('textbox', { name: 'Setup 1', exact: true }).fill(setup);
  await page.getByRole('link', { name: 'Mine this setup — Setup 1' }).click();
  await expect(page.getByRole('heading', { name: 'Mine this setup' })).toBeVisible();
}

export async function addItems(page: Page, inputName: string, items: string[]) {
  const input = page.getByRole('textbox', { name: inputName, exact: true });
  for (const item of items) {
    await input.fill(item);
    await input.press('Enter');
  }
}

export const next = (page: Page, label: string) => page.getByRole('link', { name: `Next: ${label}` }).click();
export const stepLink = (page: Page, label: string) =>
  page.getByRole('navigation', { name: 'Joke Mine steps' }).getByRole('link', { name: new RegExp(`^${label}`) });
