import { expect, test, type Page } from "@playwright/test";

const password = process.env.ADMIN_PASSWORD ?? "123456";
const username = process.env.ADMIN_USERNAME ?? "admin";

const LONG_URL =
  "https://example.com/path/to/a/very/long/resource/" +
  "abcdefghijklmnopqrstuvwxyz0123456789/".repeat(8) +
  "?q=" +
  "param".repeat(40);
const LONG_TITLE = "超长标题用于验证移动端省略与不撑宽视口-" + "标题".repeat(40);
const LONG_DESC = "超长描述用于验证移动端卡片布局稳定性-" + "描述内容".repeat(50);
const LONG_CATEGORY = "超长分类名称用于侧栏与面板标题省略-" + "分类".repeat(30);

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("账号").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("heading", { name: "链接管理" })).toBeVisible();
}

const mobileViewports = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

for (const viewport of mobileViewports) {
  test(`public home has no horizontal overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator(".mn-search-input")).toHaveAttribute("placeholder", "搜索网站或关键词", {
      timeout: 10_000,
    });
    await expect(page.locator(".mn-mobile-bar")).toBeVisible();
    await expect(page.locator(".mn-search")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const searchBox = page.locator(".mn-main-top .mn-search");
    const searchWidth = await searchBox.evaluate((el) => el.getBoundingClientRect().width);
    const barWidth = await page.locator(".mn-mobile-bar").evaluate((el) => el.getBoundingClientRect().width);
    expect(searchWidth).toBeGreaterThan(barWidth * 0.9);

    const heroTitle = page.locator(".mn-hero-title");
    const titleStyles = await heroTitle.evaluate((el) => {
      const styles = getComputedStyle(el);
      return {
        fontSize: styles.fontSize,
        lineHeight: styles.lineHeight,
        width: el.getBoundingClientRect().width,
        viewport: window.innerWidth,
      };
    });
    expect(titleStyles.fontSize).toBe("28px");
    expect(titleStyles.width).toBeLessThanOrEqual(titleStyles.viewport);

    await page.getByRole("button", { name: "打开菜单" }).click();
    await expect(page.locator(".mn-sidebar.is-open")).toBeVisible();
    await expect(page.getByRole("button", { name: /深色模式|浅色模式/ })).toBeVisible();
    await page.getByRole("button", { name: "关闭菜单" }).click();
    await expect(page.locator(".mn-sidebar.is-open")).toHaveCount(0);

    await page.getByRole("button", { name: "打开菜单" }).click();
    await expect(page.locator(".mn-sidebar.is-open")).toBeVisible();
    // Click the visible overlay strip to the right of the drawer (not under the sidebar).
    await page.mouse.click(viewport.width - 24, 120);
    await expect(page.locator(".mn-sidebar.is-open")).toHaveCount(0);
  });
}

test("admin mobile shell uses header menu and card list at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);
  await assertNoHorizontalOverflow(page);

  await expect(page.getByRole("button", { name: "打开后台菜单" })).toBeVisible();
  await expect(page.getByRole("link", { name: "查看站点" })).toHaveAttribute("aria-label", "查看站点");
  await expect(page.getByRole("link", { name: "查看站点" })).toHaveAttribute("title", "查看站点");
  await expect(
    page.getByRole("button", { name: "切换到深色模式" }).or(page.getByRole("button", { name: "切换到浅色模式" })),
  ).toBeVisible();

  await expect(page.locator(".side-nav-desktop")).toBeHidden();
  await expect(page.locator(".admin-mobile-list")).toBeVisible();
  await expect(page.locator(".admin-desktop-only")).toBeHidden();

  const panel = page.locator(".main-panel");
  const panelStyles = await panel.evaluate((el) => {
    const styles = getComputedStyle(el);
    return {
      marginLeft: styles.marginLeft,
      paddingLeft: styles.paddingLeft,
      width: el.getBoundingClientRect().width,
      viewport: window.innerWidth,
    };
  });
  expect(panelStyles.marginLeft).toBe("0px");
  expect(panelStyles.width).toBeLessThanOrEqual(panelStyles.viewport);

  await page.getByRole("button", { name: "新建链接" }).click();
  const drawer = page.locator(".drawer");
  await expect(drawer).toBeVisible();
  const drawerBox = await drawer.boundingBox();
  expect(drawerBox).toBeTruthy();
  expect(drawerBox!.x).toBeGreaterThanOrEqual(0);
  expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(375 + 1);
});

test("desktop layout remains two-column at 1440px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await assertNoHorizontalOverflow(page);
  await expect(page.locator(".mn-sidebar")).toBeVisible();
  await expect(page.locator(".mn-mobile-bar")).toBeHidden();
  await expect(page.locator(".mn-search-input")).toHaveAttribute(
    "placeholder",
    "搜索网站、关键词或直接输入网址...",
  );

  await login(page);
  await expect(page.locator(".side-nav-desktop")).toBeVisible();
  await expect(page.locator(".admin-desktop-only")).toBeVisible();
  await expect(page.locator(".admin-mobile-list")).toBeHidden();
  await expect(page.getByRole("button", { name: "切换到深色模式" }).or(page.getByRole("button", { name: "切换到浅色模式" }))).toBeVisible();
  await expect(page.locator(".theme-toggle-label")).toBeVisible();
});

test("tablet breakpoint keeps desktop chrome at 768px", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");
  await assertNoHorizontalOverflow(page);
  await expect(page.locator(".mn-mobile-bar")).toBeHidden();
  await expect(page.locator(".mn-sidebar")).toBeVisible();
});

test("dark theme keeps public and admin within viewport at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "打开菜单" }).click();
  await page.getByRole("button", { name: "切换到深色模式" }).click();
  await page.getByRole("button", { name: "关闭菜单" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await assertNoHorizontalOverflow(page);

  await login(page);
  await expect(page.getByRole("button", { name: "切换到浅色模式" })).toBeVisible();
  await page.getByRole("button", { name: "切换到浅色模式" }).click();
  await assertNoHorizontalOverflow(page);
  await expect(page.locator(".admin-mobile-list")).toBeVisible();
});

test("long titles urls and categories do not cause horizontal scroll at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });

  await page.route("**/api/public/navigation", async (route) => {
    const response = await route.fetch();
    const data = (await response.json()) as {
      categories?: Array<{
        id: string;
        name: string;
        sortOrder: number;
        links: Array<{
          id: string;
          title: string;
          url: string;
          description: string | null;
          iconUrl: string | null;
          sortOrder: number;
        }>;
      }>;
    };
    const categories = data.categories?.length
      ? data.categories
      : [
          {
            id: "long-cat",
            name: LONG_CATEGORY,
            sortOrder: 0,
            links: [],
          },
        ];
    categories[0] = {
      ...categories[0],
      name: LONG_CATEGORY,
      links: [
        {
          id: "long-link",
          title: LONG_TITLE,
          url: LONG_URL,
          description: LONG_DESC,
          iconUrl: null,
          sortOrder: 0,
        },
        ...(categories[0].links ?? []).slice(0, 2),
      ],
    };
    await route.fulfill({
      status: response.status(),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...data, categories }),
    });
  });

  await page.goto("/");
  await expect(page.locator(".mn-category-title").first()).toBeVisible();
  await expect(page.locator(".mn-link-card-title").first()).toBeVisible();
  await assertNoHorizontalOverflow(page);

  const cardWidth = await page.locator(".mn-link-card").first().evaluate((el) => el.getBoundingClientRect().width);
  expect(cardWidth).toBeLessThanOrEqual(375);

  await login(page);
  await page.evaluate(
    ({ url, title, desc, category }) => {
      const list = document.querySelector(".admin-mobile-list");
      if (!list) return;
      const card = document.createElement("li");
      card.className = "admin-mobile-card";
      card.innerHTML = `
        <div class="admin-site-cell">
          <div class="admin-site-icon"><span>L</span></div>
          <div class="admin-site-text">
            <div class="admin-site-title"></div>
            <div class="admin-site-desc"></div>
          </div>
        </div>
        <p class="admin-mobile-url"></p>
        <dl class="admin-mobile-meta">
          <div><dt>分类</dt><dd class="admin-long-cat"></dd></div>
          <div><dt>排序</dt><dd>1</dd></div>
        </dl>
        <div class="admin-mobile-actions">
          <button type="button" class="btn btn-secondary">编辑</button>
          <button type="button" class="btn btn-danger-ghost">删除</button>
        </div>
      `;
      card.querySelector(".admin-site-title")!.textContent = title;
      card.querySelector(".admin-site-desc")!.textContent = desc;
      const urlEl = card.querySelector(".admin-mobile-url") as HTMLParagraphElement;
      urlEl.textContent = url;
      urlEl.title = url;
      card.querySelector(".admin-long-cat")!.textContent = category;
      list.prepend(card);
    },
    { url: LONG_URL, title: LONG_TITLE, desc: LONG_DESC, category: LONG_CATEGORY },
  );

  const urlEl = page.locator(".admin-mobile-url").first();
  await expect(urlEl).toBeVisible();
  const urlMetrics = await urlEl.evaluate((el) => {
    const styles = getComputedStyle(el);
    return {
      whiteSpace: styles.whiteSpace,
      textOverflow: styles.textOverflow,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      cardWidth: el.closest(".admin-mobile-card")?.getBoundingClientRect().width ?? 0,
      viewport: window.innerWidth,
    };
  });
  expect(urlMetrics.whiteSpace).toBe("nowrap");
  expect(urlMetrics.textOverflow).toBe("ellipsis");
  expect(urlMetrics.scrollWidth).toBeGreaterThan(urlMetrics.clientWidth);
  expect(urlMetrics.cardWidth).toBeLessThanOrEqual(urlMetrics.viewport);
  await assertNoHorizontalOverflow(page);
});
