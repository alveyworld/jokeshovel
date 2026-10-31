import { expect, test } from '@playwright/test';

// Runs against a production build (`vite preview`, see playwright.config.ts).

test('installable: a valid manifest, and a service worker that opens the app offline', async ({ page, context }) => {
  await page.goto('/signin');

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/manifest.webmanifest');
  const manifest = await (await page.request.get(href!)).json();
  expect(manifest).toMatchObject({
    name: 'The Joke Shovel',
    short_name: 'Joke Shovel',
    start_url: '/',
    display: 'standalone',
  });
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok(), icon.src).toBe(true);

  // The worker installs and takes control.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();

  // Offline, the app shell still opens (data still needs the network).
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await context.setOffline(false);
});

test('the service worker never caches data or API responses', async ({ page }) => {
  const source = await (await page.request.get('/sw.js')).text();
  expect(source).toContain("url.origin !== self.location.origin || url.pathname.startsWith('/api/')");
});
