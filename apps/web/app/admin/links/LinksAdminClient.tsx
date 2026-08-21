"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSiteCell } from "@/components/admin/AdminSiteCell";
import { LinkIconField } from "@/components/admin/LinkIconField";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { IconCopy, IconExternal } from "@/components/icons";
import { SoftRefreshHint } from "@/components/LoadingStates";
import { useToast } from "@/components/Toast";
import { formatDateTime } from "@/lib/format";

export type CategoryOption = { id: string; name: string };
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
};

type SortKey = "checkStatus" | "title" | "url" | "category" | "sortOrder" | "createdAt";
type SortDir = "asc" | "desc";

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

function checkRank(status: LinkRow["checkStatus"]) {
  if (status === "valid") return 0;
  if (status === "invalid") return 1;
  return 2;
}

function StatusCell({
  status,
  message,
  checkedAt,
}: {
  status: LinkRow["checkStatus"];
  message: string | null;
  checkedAt: string | null;
}) {
  return (
    <div className="link-status-cell">
      {status === "valid" ? (
        <span className="link-status-badge is-valid" title={message ?? "有效"}>
          有效
        </span>
      ) : status === "invalid" ? (
        <span className="link-status-badge is-invalid" title={message ?? "无效"}>
          无效
        </span>
      ) : (
        <span className="link-status-badge is-unknown" title="尚未检测">
          未检测
        </span>
      )}
      <div className="link-status-checked-at" title={checkedAt ? formatDateTime(checkedAt) : "尚未检测"}>
        {checkedAt ? formatDateTime(checkedAt) : "—"}
      </div>
    </div>
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
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sortOrder");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LinkRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  useEffect(() => {
    setCategories(initialCategories);
    setLinks(initialLinks);
  }, [initialCategories, initialLinks]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(searchQuery), 150);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  // Soft refresh so background check results appear without triggering checks here.
  useEffect(() => {
    const timer = window.setInterval(() => {
      startTransition(() => {
        router.refresh();
      });
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [router]);

  const hasCategories = categories.length > 0;
  const hasLinks = links.length > 0;

  function refresh() {
    startTransition(() => {
      router.refresh();
    });
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
    setSortDir(key === "createdAt" ? "desc" : "asc");
  }

  const filteredLinks = useMemo(() => {
    let list = links;
    if (categoryFilter) {
      list = list.filter((row) => row.categoryId === categoryFilter);
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
          cmp = checkRank(a.checkStatus) - checkRank(b.checkStatus);
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
        case "createdAt":
          cmp = a.createdAt.localeCompare(b.createdAt);
          break;
      }
      return cmp * dir;
    });
  }, [links, categoryFilter, debouncedQuery, sortKey, sortDir, categoryName]);

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
    setFormOpen(true);
  }

  async function checkLink(row: LinkRow) {
    if (checkingId) return;
    setCheckingId(row.id);
    try {
      const res = await fetch("/api/admin/links/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        checkStatus?: "valid" | "invalid";
        checkMessage?: string;
        checkedAt?: string;
        message?: string;
        latencyMs?: number;
      };
      if (!res.ok) {
        const message = data.error ?? "检测失败";
        toast(message, "error");
        return;
      }
      const checkStatus = data.checkStatus ?? (data.ok ? "valid" : "invalid");
      const checkMessage = data.checkMessage ?? data.message ?? "";
      const checkedAt = data.checkedAt ?? new Date().toISOString();
      setLinks((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? { ...item, checkStatus, checkMessage, checkedAt }
            : item,
        ),
      );
      const latency =
        typeof data.latencyMs === "number" ? ` · ${data.latencyMs}ms` : "";
      toast(
        `${row.title}：${checkMessage}${latency}`,
        checkStatus === "valid" ? "success" : "error",
      );
    } catch {
      toast("检测失败", "error");
    } finally {
      setCheckingId(null);
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
        setError(data.error ?? "保存失败");
        return;
      }
      setFormOpen(false);
      toast(editing ? "已更新链接" : "已创建链接");
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/links/${deleteId}`, { method: "DELETE" });
      if (!res.ok) {
        toast("删除失败", "error");
        setDeleteId(null);
        return;
      }
      toast("已删除");
      setDeleteId(null);
      refresh();
    } finally {
      setDeleting(false);
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

  return (
    <div>
      <AdminPageHeader
        title="链接管理"
        description={
          linkCheckIntervalMinutes > 0
            ? `维护分类下的书签链接；外链仅允许 http/https。服务端自动检测：每 ${linkCheckIntervalMinutes} 分钟。`
            : "维护分类下的书签链接；外链仅允许 http/https。自动检测已关闭。"
        }
        badge={hasLinks ? <span className="admin-page-badge">{filteredLinks.length}</span> : null}
        actions={
          <>
            <input
              className="input admin-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索标题 / URL"
              aria-label="搜索标题或 URL"
              disabled={!hasCategories}
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
              value={`${sortKey}:${sortDir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(":") as [SortKey, SortDir];
                setSortKey(key);
                setSortDir(dir);
              }}
              aria-label="排序方式"
            >
              <option value="checkStatus:asc">状态 有效→无效</option>
              <option value="checkStatus:desc">状态 无效→有效</option>
              <option value="sortOrder:asc">排序值 ↑</option>
              <option value="sortOrder:desc">排序值 ↓</option>
              <option value="title:asc">标题 A→Z</option>
              <option value="title:desc">标题 Z→A</option>
              <option value="category:asc">分类 A→Z</option>
              <option value="category:desc">分类 Z→A</option>
              <option value="createdAt:desc">添加时间最新</option>
              <option value="createdAt:asc">添加时间最早</option>
              <option value="url:asc">URL A→Z</option>
              <option value="url:desc">URL Z→A</option>
            </select>
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreate}
              disabled={!hasCategories}
            >
              新建链接
            </button>
          </>
        }
      />

      <SoftRefreshHint show={phase === "refreshing"} />

      {phase === "empty-categories" ? (
        <EmptyState title="请先创建分类" description="链接必须归属某个分类。" />
      ) : null}

      {phase === "empty-links" ? (
        <EmptyState title="暂无链接，可新建链接" description="点击右上角「新建链接」添加。" />
      ) : null}

      {showList && hasLinks && filteredLinks.length === 0 ? (
        <EmptyState title="无匹配链接" description="试试其他关键词，或清空搜索。" icon="?" />
      ) : null}

      {showList && filteredLinks.length > 0 ? (
        <>
          <div className="admin-table-wrap admin-desktop-only">
            <table className="table">
              <thead>
                <tr>
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
                    label="添加时间"
                    column="createdAt"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredLinks.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <StatusCell
                        status={row.checkStatus}
                        message={row.checkMessage}
                        checkedAt={row.checkedAt}
                      />
                    </td>
                    <td>
                      <AdminSiteCell
                        title={row.title}
                        description={row.description}
                        iconUrl={row.iconUrl}
                      />
                    </td>
                    <td>
                      <div className="admin-url-cell">
                        <span className="admin-url-text" title={row.url}>
                          {row.url}
                        </span>
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
                      </div>
                    </td>
                    <td>{categoryName(row.categoryId)}</td>
                    <td>{row.sortOrder}</td>
                    <td style={{ whiteSpace: "nowrap", color: "var(--color-text-secondary)", fontSize: 13 }}>
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={checkingId === row.id}
                          onClick={() => void checkLink(row)}
                          title="检测网站是否可访问"
                        >
                          {checkingId === row.id ? "检测中…" : "检测"}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => openEdit(row)}>
                          编辑
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger-ghost"
                          onClick={() => setDeleteId(row.id)}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="admin-mobile-list">
            {filteredLinks.map((row) => (
              <li key={row.id} className="admin-mobile-card">
                <div className="admin-mobile-status">
                  <StatusCell
                    status={row.checkStatus}
                    message={row.checkMessage}
                    checkedAt={row.checkedAt}
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
                    <dt>添加</dt>
                    <dd>{formatDateTime(row.createdAt)}</dd>
                  </div>
                </dl>
                <div className="admin-mobile-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={checkingId === row.id}
                    onClick={() => void checkLink(row)}
                  >
                    {checkingId === row.id ? "检测中…" : "检测"}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => openEdit(row)}>
                    编辑
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger-ghost"
                    onClick={() => setDeleteId(row.id)}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {formOpen ? (
        <>
          <div className="overlay" onClick={() => !saving && setFormOpen(false)} />
          <div className="form-dialog" role="dialog" aria-modal="true" aria-labelledby="link-form-title">
            <div className="form-dialog-panel">
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
                      title="根据网址识别标题、描述与图标"
                    >
                      {detecting ? "识别中…" : "识别"}
                    </button>
                  </div>
                  <p className="admin-form-hint">填写网址后点击「识别」，自动填充标题、描述与网站图标。</p>
                </div>
                <div className="field">
                  <div className="field-label-row">
                    <label htmlFor="link-desc">描述</label>
                    <span
                      className={`field-counter${form.description.length >= 500 ? " is-limit" : ""}`}
                      aria-live="polite"
                    >
                      {form.description.length}/500
                    </span>
                  </div>
                  <textarea
                    id="link-desc"
                    className="textarea"
                    rows={3}
                    maxLength={500}
                    placeholder="可选；点击「识别」可自动抓取页面简介，也可手动填写"
                    value={form.description}
                    disabled={saving || detecting}
                    onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 500) })}
                  />
                </div>
                <LinkIconField
                  value={form.iconUrl}
                  disabled={saving || detecting}
                  onChange={(iconUrl) => setForm({ ...form, iconUrl })}
                />
                <div className="field">
                  <label htmlFor="link-sort">排序</label>
                  <input
                    id="link-sort"
                    className="input"
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                  />
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
        open={!!deleteId}
        title="删除链接？"
        message="删除后不可恢复。"
        busy={deleting}
        onCancel={() => !deleting && setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
