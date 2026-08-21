"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { EmptyState, EmptyStateLoginAction } from "@/components/EmptyState";
import { BrandMark } from "@/components/BrandMark";
import { HomeContentSkeleton } from "@/components/LoadingStates";
import { EngineSelect } from "@/components/EngineSelect";
import { IconCategory, IconChevron, IconHome, IconMenu, IconSearch } from "@/components/icons";
import { LinkCard } from "@/components/LinkCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { DAILY_QUOTE_FALLBACK } from "@/lib/daily-quote";
import { buildSearchUrl } from "@/lib/validators/search-engine";

const MOBILE_MQ = "(max-width: 767px)";
const SEARCH_PLACEHOLDER_DESKTOP = "搜索网站、关键词或直接输入网址...";
const SEARCH_PLACEHOLDER_MOBILE = "搜索网站或关键词";

function subscribeMobileViewport(onChange: () => void) {
  const mq = window.matchMedia(MOBILE_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getMobileViewportSnapshot() {
  return window.matchMedia(MOBILE_MQ).matches;
}

function getServerMobileViewportSnapshot() {
  return false;
}

type EngineOption = {
  id: string;
  name: string;
  urlTemplate: string;
  isDefault: boolean;
};

type NavLink = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  iconUrl: string | null;
  sortOrder: number;
};

type NavCategory = {
  id: string;
  name: string;
  sortOrder: number;
  visibility?: "public" | "private";
  links: NavLink[];
};

type LoadPhase = "loading" | "refreshing" | "success" | "empty" | "error";

function greetingForHour(hour: number) {
  if (hour < 5) return "夜深了";
  if (hour < 12) return "早上好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function looksLikeUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return true;
  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:].*)?$/i.test(value) && !/\s/.test(value)) return true;
  return false;
}

function formatQuoteLine(content: string, author: string | null | undefined) {
  const a = author?.trim();
  return a ? `${content} — ${a}` : content;
}

export function PublicHome() {
  const [siteName, setSiteName] = useState("LinkNest");
  const [ownerNickname, setOwnerNickname] = useState("阿凡");
  const [engines, setEngines] = useState<EngineOption[]>([]);
  const [categories, setCategories] = useState<NavCategory[]>([]);
  /** Exclusive nav selection: "home" or a category id — never both highlighted. */
  const [activeNav, setActiveNav] = useState<"home" | string>("home");
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [engineId, setEngineId] = useState("");
  const [filter, setFilter] = useState("");
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("晚上好");
  const [dailyQuoteLine, setDailyQuoteLine] = useState(DAILY_QUOTE_FALLBACK);
  const isMobileViewport = useSyncExternalStore(
    subscribeMobileViewport,
    getMobileViewportSnapshot,
    getServerMobileViewportSnapshot,
  );

  const hasContent = categories.length > 0;
  const hasContentRef = useRef(hasContent);
  hasContentRef.current = hasContent;
  const awaitingFirstPaint = fetching && !hasContent;
  const showSkeleton = useDelayedFlag(awaitingFirstPaint, 300);

  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/public/daily-quote", { signal: ac.signal });
        if (!res.ok) return;
        const data = await res.json();
        const content = data?.quote?.content?.trim();
        if (!content) return;
        setDailyQuoteLine(formatQuoteLine(content, data.quote.author ?? null));
      } catch {
        // Keep fallback; must not affect navigation/search.
      }
    })();
    return () => ac.abort();
  }, []);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const [siteRes, navRes] = await Promise.all([
        fetch("/api/public/site"),
        fetch("/api/public/navigation"),
      ]);
      if (!siteRes.ok || !navRes.ok) throw new Error("加载失败");
      const site = await siteRes.json();
      const nav = await navRes.json();
      setSiteName(site.siteName || "LinkNest");
      setOwnerNickname(
        typeof site.ownerNickname === "string" && site.ownerNickname.trim()
          ? site.ownerNickname.trim()
          : "阿凡",
      );
      const nextEngines: EngineOption[] = site.searchEngines ?? [];
      setEngines(nextEngines);
      setEngineId((prev) => {
        if (prev && nextEngines.some((e) => e.id === prev)) return prev;
        // Sole authority: site_settings.defaultSearchEngineId
        const fromSettings =
          typeof site.defaultSearchEngineId === "string" ? site.defaultSearchEngineId : null;
        if (fromSettings && nextEngines.some((e) => e.id === fromSettings)) return fromSettings;
        return nextEngines[0]?.id ?? "";
      });
      setCategories(nav.categories ?? []);
      setError(null);
    } catch {
      if (!hasContentRef.current) {
        setError("加载失败，请重试");
      }
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filterQ = filter.trim().toLowerCase();

  const filteredCategories = useMemo(() => {
    if (!filterQ) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        links: cat.links.filter(
          (l) =>
            l.title.toLowerCase().includes(filterQ) ||
            l.url.toLowerCase().includes(filterQ) ||
            (l.description ?? "").toLowerCase().includes(filterQ),
        ),
      }))
      .filter((cat) => cat.links.length > 0);
  }, [categories, filterQ]);

  /** Home shows all (filtered) categories; a category nav item shows only that group. */
  const visibleCategories = useMemo(() => {
    if (activeNav === "home") return filteredCategories;
    return filteredCategories.filter((cat) => cat.id === activeNav);
  }, [filteredCategories, activeNav]);

  const phase: LoadPhase = useMemo(() => {
    if (fetching && !hasContent) return "loading";
    if (error && !hasContent) return "error";
    if (!hasContent) return "empty";
    if (fetching) return "refreshing";
    return "success";
  }, [fetching, hasContent, error]);

  function goHome() {
    setActiveNav("home");
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectCategory(id: string) {
    setActiveNav(id);
    setCollapsedIds((prev) => ({ ...prev, [id]: false }));
    setMobileNav(false);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function toggleCategoryPanel(id: string) {
    setCollapsedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function onExternalSearch(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    if (looksLikeUrl(trimmed)) {
      const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }

    const engine = engines.find((e) => e.id === engineId) ?? engines[0];
    if (!engine) {
      setSearchHint("暂无可用搜索引擎，请先在后台添加");
      return;
    }
    setSearchHint(null);
    window.open(buildSearchUrl(engine.urlTemplate, trimmed), "_blank", "noopener,noreferrer");
  }

  const showMainSkeleton = phase === "loading" && showSkeleton;
  const showMainEmpty = phase === "empty";
  const showMainError = phase === "error";
  const showMainContent = phase === "success" || phase === "refreshing";
  const isRefreshing = phase === "refreshing";

  return (
    <div className="mn-shell">
      {mobileNav ? (
        <div className="overlay mn-mobile-overlay" onClick={() => setMobileNav(false)} />
      ) : null}

      <aside className={`mn-sidebar${mobileNav ? " is-open" : ""}`}>
        <div className="mn-sidebar-brand">
          <BrandMark />
          <div className="mn-sidebar-title">{siteName}</div>
          <button
            type="button"
            className="btn btn-ghost mn-sidebar-close"
            aria-label="关闭菜单"
            onClick={() => setMobileNav(false)}
          >
            关闭
          </button>
        </div>

        <div className="mn-sidebar-scroll">
          <nav className="mn-sidebar-nav" aria-label="导航">
            <button
              type="button"
              className={`mn-nav-item${activeNav === "home" ? " is-active" : ""}`}
              onClick={goHome}
            >
              <IconHome size={18} filled={activeNav === "home"} />
              <span className="mn-nav-label">首页</span>
            </button>

            <div className="mn-nav-group-label" aria-hidden="true">
              分类
            </div>

            {hasContent
              ? categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`mn-nav-item${activeNav === cat.id ? " is-active" : ""}`}
                    onClick={() => selectCategory(cat.id)}
                  >
                    <IconCategory id={cat.id} size={18} />
                    <span className="mn-nav-label">{cat.name}</span>
                    {cat.visibility === "private" ? (
                      <span className="mn-nav-private" title="仅管理员可见">
                        私有
                      </span>
                    ) : null}
                  </button>
                ))
              : phase === "empty" ? (
                  <div className="mn-sidebar-empty">添加公开分类后显示于此</div>
                ) : phase === "loading" ? (
                  <div className="mn-sidebar-empty mn-sidebar-loading" aria-hidden>
                    <span className="sk-block" style={{ width: "100%", height: 36, borderRadius: 8 }} />
                    <span className="sk-block" style={{ width: "88%", height: 36, borderRadius: 8, marginTop: 6 }} />
                    <span className="sk-block" style={{ width: "72%", height: 36, borderRadius: 8, marginTop: 6 }} />
                  </div>
                ) : null}
          </nav>
        </div>

        <div className="mn-sidebar-footer">
          <ThemeToggle variant="sidebar" />
        </div>
      </aside>

      <div className="mn-main">
        <div className="mn-main-top">
          <div className="mn-mobile-bar">
            <button
              type="button"
              className="btn btn-secondary mn-mobile-menu"
              aria-label="打开菜单"
              onClick={() => setMobileNav(true)}
            >
              <IconMenu size={18} />
            </button>
            <div className="mn-mobile-brand">
              <BrandMark />
              <span className="mn-mobile-brand-name">{siteName}</span>
            </div>
          </div>
          <form className="mn-search" onSubmit={onExternalSearch} role="search">
            {engines.length > 0 ? (
              <EngineSelect engines={engines} value={engineId} onChange={setEngineId} />
            ) : null}
            <input
              className="mn-search-input"
              value={query}
              onChange={(e) => {
                setSearchHint(null);
                setQuery(e.target.value);
              }}
              placeholder={isMobileViewport ? SEARCH_PLACEHOLDER_MOBILE : SEARCH_PLACEHOLDER_DESKTOP}
              aria-label="搜索"
            />
            <button
              type="submit"
              className="mn-search-submit"
              disabled={!query.trim()}
              aria-label="搜索"
            >
              <IconSearch size={18} />
            </button>
          </form>
        </div>
        {searchHint ? <p className="mn-search-hint">{searchHint}</p> : null}

        <div className={`mn-content${isRefreshing ? " mn-content-refresh is-refreshing" : ""}`}>
          <header className="mn-hero">
            <div className="mn-hero-text">
              <h1 className="mn-hero-title">
                {greeting}，{ownerNickname} <span aria-hidden>👋</span>
              </h1>
              <p className="mn-hero-desc" title={dailyQuoteLine}>
                {dailyQuoteLine}
              </p>
            </div>
            <label className="mn-bookmark-filter">
              <span className="mn-bookmark-filter-label">筛选书签</span>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="按标题 / 描述筛选"
                aria-label="筛选书签"
              />
            </label>
          </header>

          {showMainSkeleton ? <HomeContentSkeleton /> : null}

          {showMainError ? (
            <EmptyState
              title={error ?? "加载失败"}
              description="请检查网络后重试。"
              icon="!"
              action={
                <button type="button" className="btn btn-primary" onClick={() => void load()}>
                  重试
                </button>
              }
            />
          ) : null}

          {showMainEmpty ? (
            <EmptyState
              title="暂无公开分类"
              description="登录后台添加公开分类与链接后，首页会展示导航卡片。"
              action={<EmptyStateLoginAction />}
            />
          ) : null}

          {showMainContent && filterQ && filteredCategories.length === 0 ? (
            <EmptyState title="无匹配结果" description="试试其他关键词，或清空筛选。" icon="?" />
          ) : null}

          {showMainContent &&
          !filterQ &&
          activeNav !== "home" &&
          visibleCategories.length === 0 ? (
            <EmptyState title="分类不存在" description="请从左侧重新选择分类。" icon="?" />
          ) : null}

          {showMainContent
            ? visibleCategories.map((cat) => {
                const collapsed = Boolean(collapsedIds[cat.id]);
                return (
                  <section key={cat.id} id={`cat-${cat.id}`} className="mn-category-panel">
                    <button
                      type="button"
                      className="mn-category-panel-head"
                      aria-expanded={!collapsed}
                      onClick={() => toggleCategoryPanel(cat.id)}
                    >
                      <span className="mn-category-icon">
                        <IconCategory id={cat.id} size={20} />
                      </span>
                      <h2 className="mn-category-title">{cat.name}</h2>
                      {cat.visibility === "private" ? (
                        <span className="mn-category-private" title="仅管理员可见">
                          私有
                        </span>
                      ) : null}
                      <span className="mn-category-badge">{cat.links.length}</span>
                      <IconChevron
                        size={18}
                        direction={collapsed ? "down" : "up"}
                        className="mn-category-toggle"
                      />
                    </button>

                    {!collapsed ? (
                      cat.links.length === 0 ? (
                        <p className="mn-category-empty">该分类暂无链接</p>
                      ) : (
                        <div className="mn-card-grid">
                          {cat.links.map((link) => (
                            <LinkCard
                              key={link.id}
                              title={link.title}
                              url={link.url}
                              description={link.description}
                              iconUrl={link.iconUrl}
                            />
                          ))}
                        </div>
                      )
                    ) : null}
                  </section>
                );
              })
            : null}
        </div>
      </div>
    </div>
  );
}
