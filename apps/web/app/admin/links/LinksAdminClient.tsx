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
  updatedAt: string;
};

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
};

export function LinksAdminClient({ initialCategories, initialLinks }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState(initialCategories);
  const [links, setLinks] = useState(initialLinks);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<LinkRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setCategories(initialCategories);
    setLinks(initialLinks);
  }, [initialCategories, initialLinks]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(searchQuery), 150);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

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
    return list;
  }, [links, categoryFilter, debouncedQuery]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      categoryId: categoryFilter || categories[0]?.id || "",
    });
    setError(null);
    setDrawerOpen(true);
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
    setDrawerOpen(true);
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
      setDrawerOpen(false);
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
        description="维护分类下的书签链接；外链仅允许 http/https。"
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
                  <th>站点信息</th>
                  <th>URL</th>
                  <th>分类</th>
                  <th>排序</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredLinks.map((row) => (
                  <tr key={row.id}>
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
                      {formatDateTime(row.updatedAt)}
                    </td>
                    <td>
                      <div className="admin-row-actions">
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
                    <dt>更新</dt>
                    <dd>{formatDateTime(row.updatedAt)}</dd>
                  </div>
                </dl>
                <div className="admin-mobile-actions">
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

      {drawerOpen ? (
        <>
          <div className="overlay" onClick={() => !saving && setDrawerOpen(false)} />
          <div className="drawer" role="dialog" aria-modal="true">
            <div className="drawer-header">
              <strong>{editing ? "编辑链接" : "新建链接"}</strong>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={saving}
                onClick={() => setDrawerOpen(false)}
              >
                关闭
              </button>
            </div>
            <div className="drawer-body">
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
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="link-url">URL *</label>
                <input
                  id="link-url"
                  className="input"
                  placeholder="https://"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="link-desc">描述</label>
                <textarea
                  id="link-desc"
                  className="textarea"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <LinkIconField
                value={form.iconUrl}
                disabled={saving}
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
            <div className="drawer-footer">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={() => setDrawerOpen(false)}
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
