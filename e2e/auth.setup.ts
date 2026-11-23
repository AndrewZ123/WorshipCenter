import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test as setup } from '@playwright/test';
import { AUTH_FILE, BASE_URL, EXPECTED_CHURCH } from './support';

/**
 * Log in exactly once per run and persist the browser storage state so the
 * spec files never hit the rate-limited /login route themselves.
 *
 * E2E_EMAIL / E2E_PASSWORD come from the environment. Never hardcode them or
 * write them to disk here.
 */
setup('sign in as the QA church admin', async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_EMAIL and E2E_PASSWORD must be set. See e2e/README.md for setup.'
    );
  }

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });

  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  try {
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
  } catch (error) {
    const alertText = await page
      .getByRole('alert')
      .textContent({ timeout: 2_000 })
      .catch(() => null);
    const detail = alertText?.trim() ? `: ${alertText.trim()}` : '';
    throw new Error(`Login did not reach /dashboard${detail}`, {
      cause: error,
    });
  }

  // Guard against silently running against the wrong church.
  await expect(
    page.getByText(EXPECTED_CHURCH, { exact: true }).first()
  ).toBeVisible({ timeout: 30_000 });

  await mkdir(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
