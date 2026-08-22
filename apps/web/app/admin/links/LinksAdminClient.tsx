"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSiteCell } from "@/components/admin/AdminSiteCell";
import { LinkCheckStatusBadge } from "@/components/admin/LinkCheckStatusBadge";
import { LinkIconField } from "@/components/admin/LinkIconField";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { IconCopy, IconExternal, IconMore } from "@/components/icons";
import { SoftRefreshHint } from "@/components/LoadingStates";
import { useToast } from "@/components/Toast";
import { formatDateTime } from "@/lib/format";
import {
  deriveLinkHealth,
  healthSortRank,
  type LinkHealthUi,
} from "@/lib/link-check-ui";

export type CategoryOption = { id: string; name: string; visibility?: "public" | "private" };
export type LinkRow = {
  id: string;
  categoryId: string;
  title: string;
  url: string;
  description: string | null;
  iconUrl: string | null;
  sortOrder: number;
  createdAt: string;
  checkStatus: "valid" | "invalid" | null;
  checkMessage: string | null;
  checkedAt: string | null;
  checkHttpStatus: number | null;
  checkLatencyMs: number | null;
  checkError: string | null;
  health: LinkHealthUi | null;
};

type SortKey = "checkStatus" | "title" | "url" | "category" | "sortOrder" | "checkedAt" | "createdAt";
type SortDir = "asc" | "desc";
type StatusFilter = "" | "ok" | "restricted" | "bad" | "unknown";
type PageSize = 20 | 50 | 100;

type CheckApiPayload = {
  error?: string;
  ok?: boolean;
  checkStatus?: "valid" | "invalid" | null;
  checkMessage?: string;
  checkedAt?: string;
  message?: string;
  latencyMs?: number | null;
  status?: number | null;
  health?: LinkHealthUi;
  errorKind?: string | null;
};

function mergeCheckResult(row: LinkRow, data: CheckApiPayload): LinkRow {
  const health = data.health ?? null;
  const checkError =
    health === "unchecked" ? (data.errorKind ?? row.checkError) : data.errorKind ?? null;
  return {
    ...row,
    checkStatus:
      data.checkStatus === "valid" || data.checkStatus === "invalid"
        ? data.checkStatus
        : data.checkStatus === null
          ? row.checkStatus
          : data.ok
            ? "valid"
            : data.ok === false && health !== "unchecked"
              ? "invalid"
              : row.checkStatus,
    checkMessage: data.checkMessage ?? data.message ?? row.checkMessage,
    checkedAt: data.checkedAt ?? row.checkedAt,
    checkHttpStatus: data.status !== undefined ? data.status : row.checkHttpStatus,
    checkLatencyMs: data.latencyMs !== undefined ? data.latencyMs : row.checkLatencyMs,
    checkError,
    health,
  };
}

const emptyForm = {
  categoryId: "",
  title: "",
  url: "",
  description: "",
  iconUrl: "",
  sortOrder: 0,
};

type Props = {
  initialCategories: CategoryOption[];
  initialLinks: LinkRow[];
  linkCheckIntervalMinutes: number;
};

function TimeCell({ createdAt }: { createdAt: string }) {
  const full = formatDateTime(createdAt);
  const short = full.includes(" ") ? full.split(" ")[0]! : full;
  return (
    <span className="admin-time-cell" title={full}>
      <span className="admin-time-full">{full}</span>
      <span className="admin-time-short">{short}</span>
    </span>
  );
}

function SortHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === column;
  return (
    <th aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className={`table-sort-btn${active ? " is-active" : ""}`}
        onClick={() => onSort(column)}
      >
        <span>{label}</span>
        <span className="table-sort-indicator" aria-hidden>
          {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

export function LinksAdminClient({
  initialCategories,
  initialLinks,
  linkCheckIntervalMinutes,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState(initialCategories);
  const [links, setLinks] = useState(initialLinks);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sortOrder");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moreOpenId, setMoreOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LinkRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [batchCategoryId, setBatchCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCategories(initialCategories);
    setLinks(initialLinks);
  }, [initialCategories, initialLinks]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(searchQuery), 150);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, statusFilter, debouncedQuery, sortKey, sortDir, pageSize]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      startTransition(() => router.refresh());
    };
    const timer = window.setInterval(tick, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!moreRef.current) return;
      if (!moreRef.current.contains(e.target as Node)) setMoreOpenId(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!formOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) setFormOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [formOpen, saving]);

  const hasCategories = categories.length > 0;
  const hasLinks = links.length > 0;

  function refresh() {
    startTransition(() => router.refresh());
  }

  const categoryName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string) => map.get(id) ?? id;
  }, [categories]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "checkedAt" || key === "createdAt" ? "desc" : "asc");
  }

  const filteredLinks = useMemo(() => {
    let list = links;
    if (categoryFilter) list = list.filter((row) => row.categoryId === categoryFilter);
    if (statusFilter === "ok") {
      list = list.filter((row) => deriveLinkHealth(row) === "healthy");
    }
    if (statusFilter === "restricted") {
      list = list.filter((row) => deriveLinkHealth(row) === "restricted");
    }
    if (statusFilter === "bad") {
      list = list.filter((row) => deriveLinkHealth(row) === "broken");
    }
    if (statusFilter === "unknown") {
      list = list.filter((row) => deriveLinkHealth(row) === "unchecked");
    }
    const q = debouncedQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (row) => row.title.toLowerCase().includes(q) || row.url.toLowerCase().includes(q),
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "checkStatus":
          cmp = healthSortRank(deriveLinkHealth(a)) - healthSortRank(deriveLinkHealth(b));
          break;
        case "title":
          cmp = a.title.localeCompare(b.title, "zh");
          break;
        case "url":
          cmp = a.url.localeCompare(b.url);
          break;
        case "category":
          cmp = categoryName(a.categoryId).localeCompare(categoryName(b.categoryId), "zh");
          break;
        case "sortOrder":
          cmp = a.sortOrder - b.sortOrder;
          if (cmp === 0) cmp = a.title.localeCompare(b.title, "zh");
          break;
        case "checkedAt":
          cmp = (a.checkedAt ?? "").localeCompare(b.checkedAt ?? "");
          break;
        case "createdAt":
          cmp = a.createdAt.localeCompare(b.createdAt);
          break;
      }
      return cmp * dir;
    });
  }, [links, categoryFilter, statusFilter, debouncedQuery, sortKey, sortDir, categoryName]);

  const totalFiltered = filteredLinks.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize) || 1);
  const currentPage = Math.min(page, totalPages);
  const pagedLinks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLinks.slice(start, start + pageSize);
  }, [filteredLinks, currentPage, pageSize]);

  const stats = useMemo(() => {
    let ok = 0;
    let restricted = 0;
    let bad = 0;
    let unknown = 0;
    let lastChecked: string | null = null;
    for (const row of links) {
      const health = deriveLinkHealth(row);
      if (health === "healthy") ok += 1;
      else if (health === "restricted") restricted += 1;
      else if (health === "broken") bad += 1;
      else unknown += 1;
      if (row.checkedAt && (!lastChecked || row.checkedAt > lastChecked)) lastChecked = row.checkedAt;
    }
    let nextCheckLabel = "已关闭";
    if (linkCheckIntervalMinutes > 0) {
      if (lastChecked) {
        const next = new Date(new Date(lastChecked).getTime() + linkCheckIntervalMinutes * 60_000);
        nextCheckLabel = formatDateTime(next.toISOString());
      } else {
        nextCheckLabel = `每 ${linkCheckIntervalMinutes} 分钟`;
      }
    }
    return { total: links.length, ok, restricted, bad, unknown, lastChecked, nextCheckLabel };
  }, [links, linkCheckIntervalMinutes]);

  const allVisibleSelected =
    pagedLinks.length > 0 && pagedLinks.every((row) => selected.has(row.id));

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const row of pagedLinks) next.delete(row.id);
        return next;
      });
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      for (const row of pagedLinks) next.add(row.id);
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      categoryId: categoryFilter || categories[0]?.id || "",
    });
    setError(null);
    setFormOpen(true);
  }

  function openEdit(row: LinkRow) {
    setEditing(row);
    setForm({
      categoryId: row.categoryId,
      title: row.title,
      url: row.url,
      description: row.description ?? "",
      iconUrl: row.iconUrl ?? "",
      sortOrder: row.sortOrder,
    });
    setError(null);
    setMoreOpenId(null);
    setFormOpen(true);
  }

  async function checkLink(row: LinkRow) {
    if (checkingId || checkingAll) return;
    setCheckingId(row.id);
    setMoreOpenId(null);
    try {
      const res = await fetch("/api/admin/links/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      const data = (await res.json().catch(() => ({}))) as CheckApiPayload;
      if (!res.ok) {
        toast(data.error ?? "检测失败", "error");
        return;
      }
      const next = mergeCheckResult(row, data);
      setLinks((prev) => prev.map((item) => (item.id === row.id ? next : item)));
      const health = deriveLinkHealth(next);
      if (next.checkError) {
        toast("检测失败", "error");
      } else if (health === "broken") {
        toast(`${row.title}：异常`, "error");
      } else {
        toast("检测完成");
      }
    } catch {
      toast("检测失败", "error");
    } finally {
      setCheckingId(null);
    }
  }

  async function checkAllLinks() {
    if (checkingAll || checkingId || links.length === 0) return;
    setCheckingAll(true);
    try {
      const res = await fetch("/api/admin/links/check-all", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        checked?: number;
        results?: Array<
          CheckApiPayload & {
            id: string;
            checkStatus: "valid" | "invalid" | null;
            checkMessage: string;
            checkedAt: string;
          }
        >;
      };
      if (!res.ok) {
        toast(data.error ?? "检测失败", "error");
        return;
      }
      const map = new Map((data.results ?? []).map((r) => [r.id, r]));
      setLinks((prev) =>
        prev.map((row) => {
          const hit = map.get(row.id);
          return hit ? mergeCheckResult(row, hit) : row;
        }),
      );
      toast("检测完成");
      refresh();
    } catch {
      toast("检测失败", "error");
    } finally {
      setCheckingAll(false);
    }
  }

  async function batchCheckSelected() {
    const ids = [...selected];
    if (ids.length === 0 || batchBusy) return;
    setBatchBusy(true);
    let ok = 0;
    try {
      for (const id of ids) {
        const row = links.find((l) => l.id === id);
        if (!row) continue;
        const res = await fetch("/api/admin/links/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const data = (await res.json().catch(() => ({}))) as CheckApiPayload;
        if (!res.ok) continue;
        ok += 1;
        setLinks((prev) =>
          prev.map((item) => (item.id === id ? mergeCheckResult(item, data) : item)),
        );
      }
      toast(ok > 0 ? "检测完成" : "检测失败", ok > 0 ? "success" : "error");
    } finally {
      setBatchBusy(false);
    }
  }

  async function confirmBatchCategory() {
    if (!batchCategoryId || batchBusy) return;
    const ids = [...selected];
    setBatchBusy(true);
    try {
      let ok = 0;
      for (const id of ids) {
        const res = await fetch(`/api/admin/links/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryId: batchCategoryId }),
        });
        if (res.ok) ok += 1;
      }
      toast(`已移动 ${ok} 条链接`);
      setBatchCategoryId(null);
      setSelected(new Set());
      refresh();
    } finally {
      setBatchBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteIds?.length || deleting) return;
    setDeleting(true);
    try {
      let ok = 0;
      for (const id of deleteIds) {
        const res = await fetch(`/api/admin/links/${id}`, { method: "DELETE" });
        if (res.ok) ok += 1;
      }
      toast(ok === 1 ? "链接已删除" : `已删除 ${ok} 条链接`);
      setDeleteIds(null);
      setSelected(new Set());
      refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function detectFromUrl() {
    if (detecting || saving) return;
    const url = form.url.trim();
    if (!url) {
      setError("请先填写 URL");
      return;
    }
    setDetecting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/links/fetch-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        title?: string | null;
        description?: string | null;
        iconUrl?: string | null;
        finalUrl?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "识别失败");
        toast(data.error ?? "识别失败", "error");
        return;
      }
      setForm((prev) => ({
        ...prev,
        url: data.finalUrl?.trim() || prev.url,
        title: data.title?.trim() || prev.title,
        description: data.description?.trim() || prev.description,
        iconUrl: data.iconUrl?.trim() || prev.iconUrl,
      }));
      toast("已识别标题、描述与图标");
    } catch {
      setError("识别失败");
      toast("识别失败", "error");
    } finally {
      setDetecting(false);
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const payload = {
      categoryId: form.categoryId,
      title: form.title.trim(),
      url: form.url.trim(),
      description: form.description.trim() || null,
      iconUrl: form.iconUrl.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
    };
    try {
      const res = await fetch(editing ? `/api/admin/links/${editing.id}` : "/api/admin/links", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error ?? "保存失败";
        setError(msg);
        toast("保存失败", "error");
        return;
      }
      setFormOpen(false);
      toast("链接已保存");
      refresh();
    } catch {
      toast("保存失败", "error");
    } finally {
      setSaving(false);
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast("已复制链接");
    } catch {
      toast("复制失败", "error");
    }
  }

  const phase = useMemo(() => {
    if (!hasCategories) return "empty-categories" as const;
    if (!hasLinks) return "empty-links" as const;
    if (isPending) return "refreshing" as const;
    return "success" as const;
  }, [hasCategories, hasLinks, isPending]);

  const showList = phase === "success" || phase === "refreshing";
  const selectedCount = selected.size;

  return (
    <div>
      <AdminPageHeader
        title="链接管理"
        description="维护书签链接；外链仅允许 http/https。"
        badge={hasLinks ? <span className="admin-page-badge">{filteredLinks.length}</span> : null}
      />

      {hasCategories ? (
        <div className="admin-toolbar">
          <input
            className="input admin-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索标题 / URL"
            aria-label="搜索标题或 URL"
          />
          <select
            className="select admin-toolbar-category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="按分类筛选"
          >
            <option value="">全部分类</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="select admin-toolbar-category"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="按状态筛选"
          >
            <option value="">全部状态</option>
            <option value="ok">正常</option>
            <option value="restricted">受限</option>
            <option value="bad">异常</option>
            <option value="unknown">未检测</option>
          </select>
          <select
            className="select admin-toolbar-category"
            value={`${sortKey}:${sortDir}`}
            onChange={(e) => {
              const [key, dir] = e.target.value.split(":") as [SortKey, SortDir];
              setSortKey(key);
              setSortDir(dir);
            }}
            aria-label="排序方式"
          >
            <option value="sortOrder:asc">排序 ↑</option>
            <option value="sortOrder:desc">排序 ↓</option>
            <option value="checkStatus:asc">状态 正常→异常</option>
            <option value="checkStatus:desc">状态 异常→正常</option>
            <option value="checkedAt:desc">最后检测最新</option>
            <option value="checkedAt:asc">最后检测最早</option>
            <option value="createdAt:desc">添加时间最新</option>
            <option value="createdAt:asc">添加时间最早</option>
            <option value="title:asc">标题 A→Z</option>
            <option value="title:desc">标题 Z→A</option>
            <option value="category:asc">分类 A→Z</option>
            <option value="url:asc">URL A→Z</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            新建链接
          </button>
        </div>
      ) : null}

      {hasLinks ? (
        <div className="admin-stats-strip" role="status">
          <span>
            总计 <strong>{stats.total}</strong>
          </span>
          <span>
            正常 <strong className="stat-ok">{stats.ok}</strong>
          </span>
          <span>
            受限 <strong className="stat-restricted">{stats.restricted}</strong>
          </span>
          <span>
            异常 <strong className="stat-bad">{stats.bad}</strong>
          </span>
          <span>
            未检测 <strong>{stats.unknown}</strong>
          </span>
          <span className="admin-stats-sep" aria-hidden>
            ·
          </span>
          <span>
            最后检测：
            <strong>{stats.lastChecked ? formatDateTime(stats.lastChecked) : "—"}</strong>
          </span>
          <span>
            下次检测：
            <strong>{stats.nextCheckLabel}</strong>
          </span>
          <div className="admin-stats-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={checkingAll || links.length === 0}
              onClick={() => void checkAllLinks()}
            >
              {checkingAll ? "检测中…" : "立即检测全部"}
            </button>
          </div>
        </div>
      ) : null}

      {selectedCount > 0 ? (
        <div className="admin-batch-bar">
          <span className="admin-batch-count">已选 {selectedCount}</span>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={batchBusy}
            onClick={() => void batchCheckSelected()}
          >
            批量检测
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={batchBusy}
            onClick={() => setBatchCategoryId(categories[0]?.id ?? "")}
          >
            修改分类
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={batchBusy}
            onClick={() => setDeleteIds([...selected])}
          >
            删除
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setSelected(new Set())}
          >
            取消选择
          </button>
        </div>
      ) : null}

      <SoftRefreshHint show={phase === "refreshing"} />

      {phase === "empty-categories" ? (
        <EmptyState
          title="请先创建分类"
          description="链接必须归属某个分类。"
          action={
            <a className="btn btn-primary" href="/admin/categories">
              去创建分类
            </a>
          }
        />
      ) : null}
      {phase === "empty-links" ? (
        <EmptyState
          title="暂无链接"
          description="当前还没有添加链接。"
          action={
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              新建链接
            </button>
          }
        />
      ) : null}
      {showList && hasLinks && filteredLinks.length === 0 ? (
        <EmptyState title="无匹配链接" description="试试调整筛选条件。" icon="?" />
      ) : null}

      {showList && filteredLinks.length > 0 ? (
        <>
          <div className="admin-table-wrap admin-desktop-only">
            <table className="table admin-links-table">
              <thead>
                <tr>
                  <th className="admin-col-check">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      aria-label="全选当前列表"
                    />
                  </th>
                  <SortHeader
                    label="状态"
                    column="checkStatus"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="站点信息"
                    column="title"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="URL"
                    column="url"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="分类"
                    column="category"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="排序"
                    column="sortOrder"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="最后检测"
                    column="checkedAt"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="添加时间"
                    column="createdAt"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <th className="admin-col-actions">操作</th>
                </tr>
              </thead>
              <tbody>
                {pagedLinks.map((row) => (
                  <tr key={row.id} className={selected.has(row.id) ? "is-selected" : undefined}>
                    <td className="admin-col-check">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        aria-label={`选择 ${row.title}`}
                      />
                    </td>
                    <td className="admin-col-status">
                      <LinkCheckStatusBadge
                        row={row}
                        checking={checkingId === row.id || checkingAll}
                      />
                    </td>
                    <td className="admin-col-site">
                      <AdminSiteCell
                        title={row.title}
                        description={row.description}
                        iconUrl={row.iconUrl}
                      />
                    </td>
                    <td className="admin-col-url">
                      <div className="admin-url-cell">
                        <span className="admin-url-text" title={row.url}>
                          {row.url}
                        </span>
                        <span className="admin-url-hover-actions">
                          <button
                            type="button"
                            className="btn btn-icon"
                            title="复制链接"
                            aria-label="复制链接"
                            onClick={() => void copyUrl(row.url)}
                          >
                            <IconCopy size={15} />
                          </button>
                          <a
                            className="btn btn-icon"
                            title="打开链接"
                            aria-label="打开链接"
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <IconExternal size={15} />
                          </a>
                        </span>
                      </div>
                    </td>
                    <td className="admin-col-category">{categoryName(row.categoryId)}</td>
                    <td className="admin-col-sort">{row.sortOrder}</td>
                    <td className="admin-col-checked">
                      {row.checkedAt ? formatDateTime(row.checkedAt) : "—"}
                    </td>
                    <td className="admin-col-created">
                      <TimeCell createdAt={row.createdAt} />
                    </td>
                    <td className="admin-col-actions">
                      <div className="admin-row-actions-quiet">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => openEdit(row)}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={checkingId === row.id || checkingAll}
                          onClick={() => void checkLink(row)}
                        >
                          {checkingId === row.id ? "检测中…" : "检测"}
                        </button>
                        <div
                          className="admin-more"
                          ref={moreOpenId === row.id ? moreRef : undefined}
                        >
                          <button
                            type="button"
                            className="btn btn-icon"
                            aria-label="更多操作"
                            aria-expanded={moreOpenId === row.id}
                            onClick={() =>
                              setMoreOpenId((id) => (id === row.id ? null : row.id))
                            }
                          >
                            <IconMore size={16} />
                          </button>
                          {moreOpenId === row.id ? (
                            <div className="admin-more-menu" role="menu">
                              <a
                                href={row.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                role="menuitem"
                              >
                                打开链接
                              </a>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  void copyUrl(row.url);
                                  setMoreOpenId(null);
                                }}
                              >
                                复制 URL
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setSelected(new Set([row.id]));
                                  setBatchCategoryId(row.categoryId);
                                  setMoreOpenId(null);
                                }}
                              >
                                修改分类
                              </button>
                              <button
                                type="button"
                                className="is-danger"
                                role="menuitem"
                                onClick={() => {
                                  setDeleteIds([row.id]);
                                  setMoreOpenId(null);
                                }}
                              >
                                删除
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="admin-mobile-list">
            {pagedLinks.map((row) => (
              <li key={row.id} className="admin-mobile-card">
                <div className="admin-mobile-status" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleSelect(row.id)}
                    aria-label={`选择 ${row.title}`}
                  />
                  <LinkCheckStatusBadge
                    row={row}
                    checking={checkingId === row.id || checkingAll}
                  />
                </div>
                <AdminSiteCell title={row.title} description={row.description} iconUrl={row.iconUrl} />
                <p className="admin-mobile-url" title={row.url}>
                  {row.url}
                </p>
                <dl className="admin-mobile-meta">
                  <div>
                    <dt>分类</dt>
                    <dd>{categoryName(row.categoryId)}</dd>
                  </div>
                  <div>
                    <dt>排序</dt>
                    <dd>{row.sortOrder}</dd>
                  </div>
                  <div>
                    <dt>最后检测</dt>
                    <dd>{row.checkedAt ? formatDateTime(row.checkedAt) : "—"}</dd>
                  </div>
                  <div>
                    <dt>添加</dt>
                    <dd>{formatDateTime(row.createdAt)}</dd>
                  </div>
                </dl>
                <div className="admin-mobile-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => openEdit(row)}>
                    编辑
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={checkingId === row.id || checkingAll}
                    onClick={() => void checkLink(row)}
                  >
                    {checkingId === row.id ? "检测中…" : "检测"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setDeleteIds([row.id])}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="admin-pagination">
            <span className="admin-pagination-meta">
              共 {totalFiltered} 条
              {totalFiltered !== links.length ? `（筛选自 ${links.length}）` : ""}
              ，第 {currentPage} / {totalPages} 页
            </span>
            <div className="admin-pagination-controls">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </button>
              <select
                className="select"
                value={currentPage}
                aria-label="页码"
                onChange={(e) => setPage(Number(e.target.value))}
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                下一页
              </button>
              <select
                className="select"
                value={pageSize}
                aria-label="每页数量"
                onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}
              >
                <option value={20}>20 条 / 页</option>
                <option value={50}>50 条 / 页</option>
                <option value={100}>100 条 / 页</option>
              </select>
            </div>
          </div>
        </>
      ) : null}

      {formOpen ? (
        <>
          <div className="overlay" onClick={() => !saving && setFormOpen(false)} />
          <div className="form-dialog" role="dialog" aria-modal="true" aria-labelledby="link-form-title">
            <div className="form-dialog-panel form-dialog-panel--link">
              <div className="form-dialog-header">
                <strong id="link-form-title">{editing ? "编辑链接" : "新建链接"}</strong>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={saving}
                  onClick={() => setFormOpen(false)}
                >
                  关闭
                </button>
              </div>
              <div className="form-dialog-body">
                <div className="admin-form-grid-2">
                  <div className="field">
                    <label htmlFor="link-cat">分类 *</label>
                    <select
                      id="link-cat"
                      className="select"
                      value={form.categoryId}
                      onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="link-title">标题 *</label>
                    <input
                      id="link-title"
                      className="input"
                      value={form.title}
                      disabled={saving || detecting}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="link-url">URL *</label>
                  <div className="field-with-action">
                    <input
                      id="link-url"
                      className="input"
                      placeholder="https://"
                      value={form.url}
                      disabled={saving || detecting}
                      onChange={(e) => setForm({ ...form, url: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={saving || detecting || !form.url.trim()}
                      onClick={() => void detectFromUrl()}
                    >
                      {detecting ? "识别中…" : "识别"}
                    </button>
                  </div>
                  <p className="admin-form-hint">填写网址后点「识别」，可自动填充标题、描述与图标。</p>
                </div>
                <div className="field">
                  <div className="field-label-row">
                    <label htmlFor="link-desc">描述</label>
                    <span
                      className={`field-counter${form.description.length >= 500 ? " is-limit" : ""}`}
                    >
                      {form.description.length}/500
                    </span>
                  </div>
                  <textarea
                    id="link-desc"
                    className="textarea"
                    rows={3}
                    maxLength={500}
                    value={form.description}
                    disabled={saving || detecting}
                    onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 500) })}
                  />
                </div>
                <div className="admin-form-grid-2 admin-form-icon-sort">
                  <LinkIconField
                    value={form.iconUrl}
                    disabled={saving || detecting}
                    onChange={(iconUrl) => setForm({ ...form, iconUrl })}
                  />
                  <div className="field admin-form-sort-field">
                    <label htmlFor="link-sort">排序</label>
                    <input
                      id="link-sort"
                      className="input"
                      type="number"
                      value={form.sortOrder}
                      disabled={saving || detecting}
                      onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                    />
                  </div>
                </div>
                {error ? <div className="field error">{error}</div> : null}
              </div>
              <div className="form-dialog-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={saving}
                  onClick={() => setFormOpen(false)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving}
                  onClick={() => void save()}
                >
                  {saving ? "保存中…" : "保存"}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={!!deleteIds?.length}
        title={deleteIds && deleteIds.length > 1 ? `删除 ${deleteIds.length} 条链接？` : "删除链接？"}
        message="删除后不可恢复。"
        busy={deleting}
        onCancel={() => !deleting && setDeleteIds(null)}
        onConfirm={() => void confirmDelete()}
      />

      {batchCategoryId != null ? (
        <>
          <div className="overlay" onClick={() => !batchBusy && setBatchCategoryId(null)} />
          <div className="form-dialog" role="dialog" aria-modal="true" aria-labelledby="batch-cat-title">
            <div className="form-dialog-panel form-dialog-panel--sm">
              <div className="form-dialog-header">
                <strong id="batch-cat-title">批量修改分类</strong>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={batchBusy}
                  onClick={() => setBatchCategoryId(null)}
                >
                  关闭
                </button>
              </div>
              <div className="form-dialog-body">
                <p className="admin-form-hint" style={{ marginTop: 0 }}>
                  将把所选 {selectedCount || 1} 条链接移动到指定分类。
                </p>
                <div className="field">
                  <label htmlFor="batch-cat">目标分类</label>
                  <select
                    id="batch-cat"
                    className="select"
                    value={batchCategoryId}
                    onChange={(e) => setBatchCategoryId(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-dialog-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={batchBusy}
                  onClick={() => setBatchCategoryId(null)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={batchBusy}
                  onClick={() => void confirmBatchCategory()}
                >
                  {batchBusy ? "处理中…" : "确认移动"}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
