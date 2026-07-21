"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { SoftRefreshHint } from "@/components/LoadingStates";
import { useToast } from "@/components/Toast";

export type EngineRow = {
  id: string;
  name: string;
  urlTemplate: string;
  sortOrder: number;
  isDefault: boolean;
};

const emptyForm = {
  name: "",
  urlTemplate: "https://example.com/search?q={query}",
  sortOrder: 0,
  isDefault: false,
};

export function SearchEnginesAdminClient({
  initialEngines,
  defaultSearchEngineId,
}: {
  initialEngines: EngineRow[];
  /** Sole authority from site_settings — badge/selection must use this. */
  defaultSearchEngineId: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState(initialEngines);
  const [defaultId, setDefaultId] = useState(defaultSearchEngineId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<EngineRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setRows(initialEngines);
    setDefaultId(defaultSearchEngineId);
  }, [initialEngines, defaultSearchEngineId]);

  const hasData = rows.length > 0;

  function isDefaultEngine(id: string) {
    return defaultId != null && id === defaultId;
  }

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

  function openEdit(row: EngineRow) {
    setEditing(row);
    setForm({
      name: row.name,
      urlTemplate: row.urlTemplate,
      sortOrder: row.sortOrder,
      isDefault: isDefaultEngine(row.id),
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
      urlTemplate: form.urlTemplate.trim(),
      sortOrder: Number(form.sortOrder) || 0,
      isDefault: form.isDefault,
    };
    try {
      const res = await fetch(
        editing ? `/api/admin/search-engines/${editing.id}` : "/api/admin/search-engines",
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
      toast(editing ? "已更新引擎" : "已创建引擎");
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/search-engines/${deleteId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data.error ?? "删除失败", "error");
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

  const phase = useMemo(() => {
    if (!hasData) return "empty" as const;
    if (isPending) return "refreshing" as const;
    return "success" as const;
  }, [hasData, isPending]);

  return (
    <div>
      <AdminPageHeader
        title="搜索引擎"
        description="默认引擎以站点设置为准；删除默认引擎时会自动切换到剩余第一个。"
        badge={hasData ? <span className="admin-page-badge">{rows.length}</span> : null}
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            新建引擎
          </button>
        }
      />

      <SoftRefreshHint show={phase === "refreshing"} />

      {phase === "empty" ? (
        <EmptyState title="暂无引擎" description="至少需要一个搜索引擎供前台外搜使用。" />
      ) : null}

      {phase === "success" || phase === "refreshing" ? (
        <>
          <div className="admin-table-wrap admin-desktop-only">
            <table className="table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>模板</th>
                  <th>排序</th>
                  <th>默认</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>
                      <div className="admin-url-cell">
                        <span className="admin-url-text" title={row.urlTemplate}>
                          {row.urlTemplate}
                        </span>
                      </div>
                    </td>
                    <td>{row.sortOrder}</td>
                    <td>{isDefaultEngine(row.id) ? <span className="tag tag-default">默认</span> : null}</td>
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
            {rows.map((row) => (
              <li key={row.id} className="admin-mobile-card">
                <div className="admin-mobile-card-title">
                  {row.name}
                  {isDefaultEngine(row.id) ? <span className="tag tag-default">默认</span> : null}
                </div>
                <p className="admin-mobile-url" title={row.urlTemplate}>
                  {row.urlTemplate}
                </p>
                <dl className="admin-mobile-meta">
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
              <strong>{editing ? "编辑引擎" : "新建引擎"}</strong>
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
                <label htmlFor="eng-name">名称 *</label>
                <input
                  id="eng-name"
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="eng-tpl">URL 模板 *（须含 {"{query}"}）</label>
                <input
                  id="eng-tpl"
                  className="input"
                  value={form.urlTemplate}
                  onChange={(e) => setForm({ ...form, urlTemplate: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="eng-sort">排序</label>
                <input
                  id="eng-sort"
                  className="input"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                />
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                />
                设为默认
              </label>
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
        title="删除搜索引擎？"
        message="至少需保留一个引擎；若删除的是默认引擎，将自动切换到剩余第一个。"
        busy={deleting}
        onCancel={() => !deleting && setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
