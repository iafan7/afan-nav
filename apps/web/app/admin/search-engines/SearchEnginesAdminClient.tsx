"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { IconGrip } from "@/components/icons";
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
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialEngines);
    setDefaultId(defaultSearchEngineId);
  }, [initialEngines, defaultSearchEngineId]);

  const hasData = rows.length > 0;

  function isDefaultEngine(id: string) {
    return defaultId != null && id === defaultId;
  }

  function refresh() {
    startTransition(() => router.refresh());
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
      toast("搜索引擎已保存");
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function setAsDefault(id: string) {
    if (settingDefaultId || isDefaultEngine(id)) return;
    setSettingDefaultId(id);
    try {
      const res = await fetch(`/api/admin/search-engines/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data.error ?? "设置失败", "error");
        return;
      }
      setDefaultId(id);
      toast("已设为默认搜索引擎");
      refresh();
    } finally {
      setSettingDefaultId(null);
    }
  }

  async function persistOrder(nextRows: EngineRow[]) {
    setReordering(true);
    try {
      await Promise.all(
        nextRows.map((row, index) =>
          fetch(`/api/admin/search-engines/${row.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: index }),
          }),
        ),
      );
      toast("搜索引擎顺序已更新");
      refresh();
    } catch {
      toast("排序保存失败", "error");
      setRows(initialEngines);
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
      toast("搜索引擎已删除");
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
        description="拖拽调整顺序；可直接设为默认，无需进入编辑。"
        badge={hasData ? <span className="admin-page-badge">{rows.length}</span> : null}
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            新建引擎
          </button>
        }
      />

      <SoftRefreshHint show={phase === "refreshing" || reordering} />

      {phase === "empty" ? (
        <EmptyState title="暂无引擎" description="至少需要一个搜索引擎供前台外搜使用。" />
      ) : null}

      {phase === "success" || phase === "refreshing" ? (
        <>
          <div className="admin-table-wrap admin-desktop-only">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }} />
                  <th>名称</th>
                  <th>搜索模板</th>
                  <th>默认</th>
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
                      <div className="admin-url-cell" style={{ maxWidth: 280 }}>
                        <span className="admin-url-text" title={row.urlTemplate}>
                          {row.urlTemplate.includes("{query}") ? (
                            <>
                              {row.urlTemplate.split("{query}")[0]}
                              <mark className="admin-query-mark">{"{query}"}</mark>
                              {row.urlTemplate.split("{query}").slice(1).join("{query}")}
                            </>
                          ) : (
                            row.urlTemplate
                          )}
                        </span>
                      </div>
                    </td>
                    <td>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="radio"
                          name="default-engine"
                          checked={isDefaultEngine(row.id)}
                          disabled={settingDefaultId != null}
                          onChange={() => void setAsDefault(row.id)}
                        />
                        {isDefaultEngine(row.id) ? (
                          <span className="tag tag-default">默认</span>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>设为默认</span>
                        )}
                      </label>
                    </td>
                    <td>
                      <div className="admin-row-actions-quiet">
                        <button type="button" className="btn btn-secondary" onClick={() => openEdit(row)}>
                          编辑
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
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
                <div className="admin-mobile-actions">
                  {!isDefaultEngine(row.id) ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={settingDefaultId != null}
                      onClick={() => void setAsDefault(row.id)}
                    >
                      设为默认
                    </button>
                  ) : null}
                  <button type="button" className="btn btn-secondary" onClick={() => openEdit(row)}>
                    编辑
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
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
          <div className="form-dialog" role="dialog" aria-modal="true" aria-labelledby="eng-form-title">
            <div className="form-dialog-panel form-dialog-panel--sm">
              <div className="form-dialog-header">
                <strong id="eng-form-title">{editing ? "编辑引擎" : "新建引擎"}</strong>
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
                  <label htmlFor="eng-name">名称 *</label>
                  <input
                    id="eng-name"
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="eng-tpl">搜索模板 *（须含 {"{query}"}）</label>
                  <input
                    id="eng-tpl"
                    className="input"
                    value={form.urlTemplate}
                    onChange={(e) => setForm({ ...form, urlTemplate: e.target.value })}
                  />
                </div>
                <div className="admin-form-grid-2">
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
                  <label
                    className="field"
                    style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 22 }}
                  >
                    <input
                      type="checkbox"
                      checked={form.isDefault}
                      onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                    />
                    设为默认
                  </label>
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
