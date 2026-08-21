import { expect, test, type Page } from "@playwright/test";

/**
 * Runs only on the isolated linknest-e2e-security stack.
 * Must not touch the deployed ./data volume.
 */
const username = process.env.ADMIN_USERNAME ?? "e2e-admin";
const originalPassword = process.env.ADMIN_PASSWORD ?? "e2epass1";
const tempPassword = "TempPw-E2E-9x";

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  if (process.env.E2E_SECURITY_ISOLATED !== "1") {
    throw new Error(
      "Refusing to run password-mutation E2E without E2E_SECURITY_ISOLATED=1 (use apps/web/e2e-security/run-isolated.sh)",
    );
  }
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "";
  if (base.includes(":3000") && !process.env.E2E_ALLOW_PORT_3000) {
    throw new Error(
      "Refusing password-mutation E2E against port 3000 (deployed stack). Use isolated port 3101.",
    );
  }
});

async function login(page: Page, password: string) {
  await page.goto("/login");
  await page.getByLabel("账号").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("heading", { name: "链接管理" })).toBeVisible();
}

async function changePassword(page: Page, current: string, next: string) {
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "安全设置" })).toBeVisible();
  await page.locator("#current-password").fill(current);
  await page.locator("#new-password").fill(next);
  await page.locator("#confirm-password").fill(next);
  await page.getByRole("button", { name: "修改密码" }).click();
  await expect(page.getByText("密码修改成功，新密码已立即生效")).toBeVisible();
}

async function expectLoginFails(page: Page, password: string) {
  await page.goto("/login");
  await page.getByLabel("账号").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText("账号或密码错误")).toBeVisible();
}

test("password change invalidates other sessions and keeps current", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await login(pageA, originalPassword);
    await login(pageB, originalPassword);

    await changePassword(pageA, originalPassword, tempPassword);

    // Current session remains usable immediately
    await pageA.goto("/admin/links");
    await expect(pageA.getByRole("heading", { name: "链接管理" })).toBeVisible();

    // Other session forced to login
    await pageB.goto("/admin/links");
    await expect(pageB).toHaveURL(/\/login/);

    await expectLoginFails(pageB, originalPassword);
    await login(pageB, tempPassword);
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test("security settings usable at 375px light and dark", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  // Serial: previous test left password as tempPassword
  await login(page, tempPassword);

  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "安全设置" })).toBeVisible();

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

  await page.getByRole("button", { name: /切换到深色模式|切换到浅色模式/ }).first().click();
  const overflowDark = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflowDark.scrollWidth).toBeLessThanOrEqual(overflowDark.clientWidth);
  await expect(page.locator("#current-password")).toBeVisible();
  await expect(page.getByRole("button", { name: "修改密码" })).toBeVisible();
});
