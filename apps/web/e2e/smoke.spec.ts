import { expect, test } from "@playwright/test";

const password = process.env.ADMIN_PASSWORD ?? "123456";
const username = process.env.ADMIN_USERNAME ?? "admin";

test("public home loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("search")).toBeVisible();
  await expect(page.locator(".mn-sidebar")).toBeVisible();
});

test("login and create public category + link then export", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("账号").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("heading", { name: "链接管理" })).toBeVisible();

  const catName = `公开-${Date.now()}`;
  await page.getByRole("link", { name: "分类管理" }).click();
  await expect(page.getByRole("heading", { name: "分类管理" })).toBeVisible();
  await page.getByRole("button", { name: "新建分类" }).click();
  await page.getByLabel("名称").fill(catName);
  await page.getByLabel("可见性").selectOption("public");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.locator(".admin-desktop-only").getByText(catName)).toBeVisible();
  await expect(page.getByText("公开").first()).toBeVisible();

  const linkTitle = `Example-${Date.now()}`;
  await page.getByRole("link", { name: "链接管理" }).click();
  await page.getByRole("button", { name: "新建链接" }).click();
  await page.getByRole("textbox", { name: "标题 *" }).fill(linkTitle);
  await page.getByRole("textbox", { name: "URL *" }).fill(`https://example.com/${Date.now()}`);
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.locator(".admin-desktop-only .admin-site-title", { hasText: linkTitle })).toBeVisible();

  // Ensure form closed before using side nav
  await page.keyboard.press("Escape");
  await expect(page.locator(".overlay")).toHaveCount(0);

  await page.getByRole("link", { name: "备份导入" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/linknest-export/);
});
