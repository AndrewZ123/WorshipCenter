import { expect, type Page } from '@playwright/test';

/**
 * Shared E2E constants and helpers.
 *
 * Credentials are read from the environment by the setup project
 * (see auth.setup.ts). Nothing in this file is secret.
 */

export const BASE_URL = (
  process.env.E2E_BASE_URL ?? 'https://app.worshipcenter.app'
).replace(/\/+$/, '');

/**
 * The real QA church this suite is allowed to touch. Override only when
 * intentionally pointing the suite at another disposable test church.
 */
export const EXPECTED_CHURCH =
  process.env.E2E_CHURCH_NAME ?? 'ZZ Test Church (Cody QA)';

/** Written by the setup project, read by the chromium project. */
export const AUTH_FILE = 'e2e/.auth/user.json';

/** Unique per test run so leftovers are obvious and easy to grep. */
export const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');
export const TEST_PREFIX = `E2E ${RUN_ID}`;

/**
 * Fail fast when the session is not inside the expected QA church. The
 * workspace name is rendered in the AppShell sidebar on every app page.
 */
export async function expectInTestChurch(page: Page): Promise<void> {
  await expect(
    page.getByText(EXPECTED_CHURCH, { exact: true }).first()
  ).toBeVisible({ timeout: 30_000 });
}
