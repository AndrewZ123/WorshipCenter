import { expect, test, type Page } from '@playwright/test';
import {
  AUTH_FILE,
  BASE_URL,
  TEST_PREFIX,
  expectInTestChurch,
} from './support';

/**
 * Serial by design: one worker, one signed-in storage state, and cleanup that
 * runs after the flow even when an assertion fails. Sign-out is deliberately
 * the final block so it cannot revoke the session before cleanup.
 */

const serviceTitles: string[] = [];
let createdGroupName: string | null = null;

async function openBlankServiceModal(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Create Service' }).first().click();

  // The header button is a split menu when templates exist and a plain
  // button when they do not. Handle both without assuming template data.
  const blankService = page.getByRole('menuitem', { name: 'Blank Service' });
  if (await blankService.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await blankService.click();
  }
}

async function cleanupServices(page: Page): Promise<void> {
  const titles = [...new Set(serviceTitles)].reverse();
  if (titles.length === 0) return;

  await page.goto('/services');
  await expect(
    page.getByText('Plan and manage your worship services')
  ).toBeVisible({ timeout: 45_000 });

  for (const title of titles) {
    const row = page.getByRole('row').filter({ hasText: title });
    if ((await row.count()) === 0) continue;

    await row.first().getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Delete Service' }).click();

    await expect(
      page.getByRole('row').filter({ hasText: title })
    ).toHaveCount(0, { timeout: 30_000 });
  }
}

async function cleanupGroup(page: Page): Promise<void> {
  if (!createdGroupName) return;

  const groupName = createdGroupName;
  await page.goto('/team');
  await expect(page.getByText('Your Team', { exact: true })).toBeVisible({
    timeout: 45_000,
  });
  await page.getByRole('tab', { name: 'Groups' }).click();
  await expect(
    page.getByText('Organize members into groups for easier scheduling')
  ).toBeVisible();

  const groupText = page.getByText(groupName, { exact: true });
  if ((await groupText.count()) === 0) return;

  const groupCard = groupText.locator(
    'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " chakra-card ")][1]'
  );
  await groupCard.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete Group' }).click();

  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Delete', exact: true }).click();

  await expect(groupText).toHaveCount(0, { timeout: 30_000 });
}

test.describe.serial('QA church app flows', () => {
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: BASE_URL,
      storageState: AUTH_FILE,
    });
    const page = await context.newPage();
    let cleanupError: unknown;

    try {
      // Always attempt both cleanups, even if the first one fails.
      try {
        await cleanupServices(page);
      } catch (error) {
        cleanupError = error;
        console.error('[e2e] Service cleanup failed:', error);
      }

      try {
        await cleanupGroup(page);
      } catch (error) {
        cleanupError ??= error;
        console.error('[e2e] Group cleanup failed:', error);
      }
    } finally {
      await context.close();
    }

    if (cleanupError) throw cleanupError;
  });

  test('login persisted and the dashboard loads for the test church', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    await expectInTestChurch(page);

    await expect(page.getByText('Total Services')).toBeVisible();
  });

  test('songs page loads', async ({ page }) => {
    await page.goto('/songs');
    await expect(page).toHaveURL(/\/songs/);
    await expect(page.getByText('Song Library', { exact: true })).toBeVisible();
    await expectInTestChurch(page);
  });

  test('team page loads', async ({ page }) => {
    await page.goto('/team');
    await expect(page.getByText('Your Team', { exact: true })).toBeVisible();
    await expectInTestChurch(page);

    await page.getByRole('tab', { name: 'Groups' }).click();
    await expect(
      page.getByText('Organize members into groups for easier scheduling')
    ).toBeVisible();
  });

  test('creates a disposable group', async ({ page }) => {
    createdGroupName = `${TEST_PREFIX} group`;

    await page.goto('/team');
    await expect(page.getByText('Your Team', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Groups' }).click();
    await expect(
      page.getByText('Organize members into groups for easier scheduling')
    ).toBeVisible();

    await page.getByRole('button', { name: 'Create Group' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Create Group' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Group Name').fill(createdGroupName);
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(
      page.getByText(createdGroupName, { exact: true })
    ).toBeVisible();
  });

  test('chat can send a message', async ({ page }) => {
    await page.goto('/chat');
    await expectInTestChurch(page);

    const input = page.getByRole('textbox', { name: 'Type a message...' });
    await expect(input).toBeVisible({ timeout: 45_000 });

    const message = `${TEST_PREFIX} chat check`;
    await input.click();
    await page.keyboard.type(message);

    const send = page.getByRole('button', { name: 'Send message' });
    await expect(send).toBeEnabled();
    await send.click();

    await expect(page.getByText(message, { exact: true })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('reports page loads', async ({ page }) => {
    await page.goto('/reports');
    await expect(
      page.getByRole('heading', { name: 'Service Reports & Analytics' })
    ).toBeVisible({ timeout: 45_000 });
    await expectInTestChurch(page);
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings');
    await expect(
      page.getByRole('heading', { name: 'Settings', exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Profile Settings' })
    ).toBeVisible();
    await expectInTestChurch(page);
  });

  test('services CRUD and share link on a disposable service', async ({
    page,
  }) => {
    const serviceTitle = `${TEST_PREFIX} service`;
    const editedTitle = `${serviceTitle} edited`;
    serviceTitles.push(serviceTitle);

    await page.goto('/services');
    await expect(
      page.getByText('Plan and manage your worship services')
    ).toBeVisible({ timeout: 45_000 });
    await expectInTestChurch(page);

    // Create.
    await openBlankServiceModal(page);
    const createDialog = page.getByRole('dialog', { name: 'Create Service' });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel('Service Title').fill(serviceTitle);
    await createDialog
      .getByLabel('Date')
      .fill(new Date().toISOString().slice(0, 10));
    await createDialog.getByLabel('Time').fill('10:00');
    await createDialog
      .getByRole('button', { name: 'Create', exact: true })
      .click();

    await expect(page.getByText('Service created')).toBeVisible();
    const row = page.getByRole('row').filter({ hasText: serviceTitle });
    await expect(row).toBeVisible({ timeout: 30_000 });

    // Open.
    await row.first().click();
    await expect(page).toHaveURL(/\/services\/[^/]+$/);
    await expect(
      page.getByText(serviceTitle, { exact: true }).first()
    ).toBeVisible();

    // Edit one field.
    await page.getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit Service' }).click();
    const titleInput = page.getByLabel('Title', { exact: true });
    await expect(titleInput).toBeVisible();
    await titleInput.fill(editedTitle);
    serviceTitles.push(editedTitle);
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByText('Service updated')).toBeVisible();
    await expect(
      page.getByText(editedTitle, { exact: true }).first()
    ).toBeVisible();

    // Share link.
    await page.getByRole('button', { name: 'Share service' }).click();
    const shareDialog = page.getByRole('dialog', { name: 'Share Service' });
    await expect(shareDialog).toBeVisible();

    const enableShare = shareDialog.getByRole('button', {
      name: 'Enable Share Link',
    });
    if (await enableShare.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await enableShare.click();
    }

    await expect(
      shareDialog.getByRole('button', { name: 'Copy Link' })
    ).toBeVisible({ timeout: 30_000 });

    const shareText = shareDialog
      .getByText(/\/share\/[A-Za-z0-9_-]+/)
      .first();
    await expect(shareText).toBeVisible();
    const shareUrl = (await shareText.textContent())?.trim() ?? '';
    expect(shareUrl).toMatch(/\/share\/[A-Za-z0-9_-]+/);

    // The generated link must work as a public page (no session required).
    const publicUrl = shareUrl.startsWith('http')
      ? shareUrl
      : `${BASE_URL}${shareUrl}`;
    await page.goto(publicUrl, { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByText(editedTitle, { exact: true }).first()
    ).toBeVisible({ timeout: 45_000 });
    await expect(
      page.getByText('Shared from WorshipCenter', { exact: true })
    ).toBeVisible();
  });
});

test.describe.serial('sign out', () => {
  test('sign out lands on /login and a leftover session does not bounce back', async ({
    page,
  }) => {
    const email = process.env.E2E_EMAIL;
    if (!email) {
      throw new Error('E2E_EMAIL must be set. See e2e/README.md for setup.');
    }

    await page.goto('/dashboard');
    await expectInTestChurch(page);

    await page.locator('button').filter({ hasText: email }).first().click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
    await expect(
      page.getByRole('button', { name: 'Sign In' })
    ).toBeVisible();

    // Wait for the Supabase session to be removed before reloading, so the
    // reload really exercises "no leftover session" instead of racing the
    // in-flight sign-out request.
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              Object.keys(localStorage).filter((key) =>
                key.includes('-auth-token')
              ).length
          ),
        { timeout: 30_000 }
      )
      .toBe(0);

    // Reload the protected route: no leftover session may restore the app.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
    await expect(
      page.getByRole('heading', { name: 'Welcome back' })
    ).toBeVisible();
  });
});
