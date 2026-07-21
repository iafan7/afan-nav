import { expect, test } from "@playwright/test";

test("login page has no production password tip", async ({ page }) => {
  await page.goto("/login");
  const body = await page.locator("body").innerText();
  expect(body).not.toContain("生产环境");
  expect(body).not.toContain("轮换弱口令");
  await expect(page.getByText("管理员登录")).toBeVisible();
});
