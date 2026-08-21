"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { SoftRefreshHint } from "@/components/LoadingStates";
import { useToast } from "@/components/Toast";
import { visibilityLabel, visibilityTagClass } from "@/lib/visibility";

export type CategoryRow = {
  id: string;
  name: string;
  sortOrder: number;
  visibility: "public" | "private";
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

  useEffect(() => {
    setRows(initialCategories);
  }, [initialCategories]);

  const hasData = rows.length > 0;

  function refresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setDrawerOpen(true);
  }

  function openEdit(row: CategoryRow) {
    setEditing(row);
    setForm({
      name: row.name,
      sortOrder: row.sortOrder,
      visibility: row.visibility,
    });
    setError(null);
    setDrawerOpen(true);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      sortOrder: Number(form.sortOrder) || 0,
      visibility: form.visibility,
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
      toast(editing ? "已更新分类" : "已创建分类");
      refresh();
    } finally {
      setSaving(false);
    }
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
      toast("已删除");
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
        toast("已删除");
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
        description="控制分类在前台是否展示（显示 / 隐藏）。"
        badge={hasData ? <span className="admin-page-badge">{rows.length}</span> : null}
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            新建分类
          </button>
        }
      />

      <SoftRefreshHint show={phase === "refreshing"} />

      {phase === "empty" ? <EmptyState title="暂无分类" description="先创建分类，再添加链接。" /> : null}

      {phase === "success" || phase === "refreshing" ? (
        <>
          <div className="admin-table-wrap admin-desktop-only">
            <table className="table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>前台显示</th>
                  <th>排序</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>
                      <span className={`tag ${visibilityTagClass(row.visibility)}`}>
                        {visibilityLabel(row.visibility)}
                      </span>
                    </td>
                    <td>{row.sortOrder}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => openEdit(row)}>
                          编辑
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger-ghost"
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
                    <dt>前台显示</dt>
                    <dd>
                      <span className={`tag ${visibilityTagClass(row.visibility)}`}>
                        {visibilityLabel(row.visibility)}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>排序</dt>
                    <dd>{row.sortOrder}</dd>
                  </div>
                </dl>
                <div className="admin-mobile-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => openEdit(row)}>
                    编辑
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger-ghost"
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
          <div className="drawer" role="dialog" aria-modal="true">
            <div className="drawer-header">
              <strong>{editing ? "编辑分类" : "新建分类"}</strong>
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
                <label htmlFor="cat-name">名称 *</label>
                <input
                  id="cat-name"
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="cat-vis">前台显示 *</label>
                <select
                  id="cat-vis"
                  className="select"
                  value={form.visibility}
                  onChange={(e) =>
                    setForm({ ...form, visibility: e.target.value as "public" | "private" })
                  }
                >
                  <option value="public">显示</option>
                  <option value="private">隐藏</option>
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
