"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { IconGrip } from "@/components/icons";
import { SoftRefreshHint } from "@/components/LoadingStates";
import { useToast } from "@/components/Toast";
import { formatDateTime } from "@/lib/format";
import { visibilityLabel, visibilityTagClass } from "@/lib/visibility";

export type CategoryRow = {
  id: string;
  name: string;
  sortOrder: number;
  visibility: "public" | "private";
  updatedAt: string;
  linkCount: number;
};

const emptyForm = {
  name: "",
  sortOrder: 0,
  visibility: "public" as "public" | "private",
};

export function CategoriesAdminClient({ initialCategories }: { initialCategories: CategoryRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState(initialCategories);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    setRows(initialCategories);
  }, [initialCategories]);

  const hasData = rows.length > 0;

  function refresh() {
    startTransition(() => router.refresh());
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setDrawerOpen(true);
  }

  function openEdit(row: CategoryRow) {
    setEditing(row);
    setForm({ name: row.name, sortOrder: row.sortOrder, visibility: row.visibility });
    setError(null);
    setDrawerOpen(true);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      visibility: form.visibility,
      sortOrder: Number(form.sortOrder) || 0,
    };
    try {
      const res = await fetch(
        editing ? `/api/admin/categories/${editing.id}` : "/api/admin/categories",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "保存失败");
        return;
      }
      setDrawerOpen(false);
      toast("分类已保存");
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function persistOrder(nextRows: CategoryRow[]) {
    setReordering(true);
    try {
      await Promise.all(
        nextRows.map((row, index) =>
          fetch(`/api/admin/categories/${row.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: index }),
          }),
        ),
      );
      toast("分类顺序已更新");
      refresh();
    } catch {
      toast("排序保存失败", "error");
      setRows(initialCategories);
    } finally {
      setReordering(false);
    }
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId || reordering) return;
    const from = rows.findIndex((r) => r.id === dragId);
    const to = rows.findIndex((r) => r.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    const withOrder = next.map((r, i) => ({ ...r, sortOrder: i }));
    setRows(withOrder);
    setDragId(null);
    setDragOverId(null);
    void persistOrder(withOrder);
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/categories/${deleteTarget.id}?confirm=true`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data.error ?? "删除失败", "error");
        setDeleteTarget(null);
        return;
      }
      toast("分类已删除");
      setDeleteTarget(null);
      refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function requestDelete(row: CategoryRow) {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/categories/${row.id}`, { method: "DELETE" });
      if (res.status === 204) {
        toast("分类已删除");
        refresh();
        return;
      }
      if (res.status === 400) {
        setDeleteTarget(row);
        return;
      }
      const data = await res.json().catch(() => ({}));
      toast(data.error ?? "删除失败", "error");
    } finally {
      setDeleting(false);
    }
  }

  const phase = useMemo(() => {
    if (!hasData) return "empty" as const;
    if (isPending) return "refreshing" as const;
    return "success" as const;
  }, [hasData, isPending]);

  return (
    <div>
      <AdminPageHeader
        title="分类管理"
        description="公开分类所有人可见；私有分类仅管理员登录后在前台可见。拖拽左侧手柄可调整顺序。"
        badge={hasData ? <span className="admin-page-badge">{rows.length}</span> : null}
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            新建分类
          </button>
        }
      />

      <SoftRefreshHint show={phase === "refreshing" || reordering} />

      {phase === "empty" ? <EmptyState title="暂无分类" description="先创建分类，再添加链接。" /> : null}

      {phase === "success" || phase === "refreshing" ? (
        <>
          <div className="admin-table-wrap admin-desktop-only">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }} />
                  <th>分类名称</th>
                  <th>可见性</th>
                  <th>链接数量</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`admin-drag-row${dragId === row.id ? " is-dragging" : ""}${
                      dragOverId === row.id ? " is-drag-over" : ""
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverId(row.id);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      onDrop(row.id);
                    }}
                  >
                    <td>
                      <button
                        type="button"
                        className="admin-drag-handle"
                        draggable
                        aria-label={`拖拽排序 ${row.name}`}
                        onDragStart={() => setDragId(row.id)}
                        onDragEnd={() => {
                          setDragId(null);
                          setDragOverId(null);
                        }}
                      >
                        <IconGrip size={14} />
                      </button>
                    </td>
                    <td>{row.name}</td>
                    <td>
                      <span className={`tag ${visibilityTagClass(row.visibility)}`}>
                        {visibilityLabel(row.visibility)}
                      </span>
                    </td>
                    <td>{row.linkCount}</td>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "var(--color-text-secondary)" }}>
                      {formatDateTime(row.updatedAt)}
                    </td>
                    <td>
                      <div className="admin-row-actions-quiet">
                        <button type="button" className="btn btn-secondary" onClick={() => openEdit(row)}>
                          编辑
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={deleting}
                          onClick={() => void requestDelete(row)}
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
            {rows.map((row) => (
              <li key={row.id} className="admin-mobile-card">
                <div className="admin-mobile-card-title">{row.name}</div>
                <dl className="admin-mobile-meta">
                  <div>
                    <dt>可见性</dt>
                    <dd>
                      <span className={`tag ${visibilityTagClass(row.visibility)}`}>
                        {visibilityLabel(row.visibility)}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>链接</dt>
                    <dd>{row.linkCount}</dd>
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
                    className="btn btn-secondary"
                    disabled={deleting}
                    onClick={() => void requestDelete(row)}
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
          <div className="form-dialog" role="dialog" aria-modal="true" aria-labelledby="cat-form-title">
            <div className="form-dialog-panel form-dialog-panel--sm">
              <div className="form-dialog-header">
                <strong id="cat-form-title">{editing ? "编辑分类" : "新建分类"}</strong>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={saving}
                  onClick={() => setDrawerOpen(false)}
                >
                  关闭
                </button>
              </div>
              <div className="form-dialog-body">
                <div className="field">
                  <label htmlFor="cat-name">分类名称 *</label>
                  <input
                    id="cat-name"
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="admin-form-grid-2">
                  <div className="field">
                    <label htmlFor="cat-vis">可见性 *</label>
                    <select
                      id="cat-vis"
                      className="select"
                      value={form.visibility}
                      onChange={(e) =>
                        setForm({ ...form, visibility: e.target.value as "public" | "private" })
                      }
                    >
                      <option value="public">公开</option>
                      <option value="private">私有（仅管理员可见）</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="cat-sort">排序</label>
                    <input
                      id="cat-sort"
                      className="input"
                      type="number"
                      value={form.sortOrder}
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
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除非空分类？"
        message={`「${deleteTarget?.name ?? ""}」下仍有链接，确认后将一并删除。`}
        busy={deleting}
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
