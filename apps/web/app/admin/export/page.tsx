"use client";

import { useRef, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

function exportFilename(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `linknest-export-${y}-${m}-${d}.json`;
}

type PreviewCounts = {
  categories: number;
  links: number;
  searchEngines: number;
  siteName: string | null;
  hasSiteSettings: boolean;
};

function previewFromSnapshot(parsed: unknown): PreviewCounts | null {
  if (!parsed || typeof parsed !== "object") return null;
  const snap = parsed as Record<string, unknown>;
  const categories = Array.isArray(snap.categories) ? snap.categories.length : 0;
  const links = Array.isArray(snap.links) ? snap.links.length : 0;
  const searchEngines = Array.isArray(snap.searchEngines) ? snap.searchEngines.length : 0;
  const hasSiteSettings = snap.siteSettings != null && typeof snap.siteSettings === "object";
  const siteSettings = hasSiteSettings ? (snap.siteSettings as Record<string, unknown>) : null;
  const siteName =
    typeof siteSettings?.siteName === "string" ? siteSettings.siteName : null;
  return { categories, links, searchEngines, siteName, hasSiteSettings };
}

export default function ExportAdminPage() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingSnapshot, setPendingSnapshot] = useState<unknown>(null);
  const [preview, setPreview] = useState<PreviewCounts | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function exportJson() {
    if (exporting || importing) return;
    setExporting(true);
    try {
      const res = await fetch("/api/admin/export");
      if (!res.ok) {
        toast("导出失败", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exportFilename();
      a.click();
      URL.revokeObjectURL(url);
      toast("导出已开始下载");
    } catch {
      toast("导出失败", "error");
    } finally {
      setExporting(false);
    }
  }

  async function onPickFile(file: File | undefined) {
    if (!file || exporting || importing) return;
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const counts = previewFromSnapshot(parsed);
      if (!counts || counts.searchEngines < 1) {
        toast("JSON 格式无效或缺少搜索引擎", "error");
        setPendingSnapshot(null);
        setPreview(null);
        setSelectedName(null);
        return;
      }
      setPendingSnapshot(parsed);
      setPreview(counts);
      setSelectedName(file.name);
    } catch {
      toast("无法解析 JSON 文件", "error");
      setPendingSnapshot(null);
      setPreview(null);
      setSelectedName(null);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function confirmImport() {
    if (!pendingSnapshot || importing) return;
    setImporting(true);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, snapshot: pendingSnapshot }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        categories?: number;
        links?: number;
        searchEngines?: number;
      };
      if (!res.ok) {
        toast(data.error ?? "导入失败", "error");
        return;
      }
      toast(
        `导入成功：${data.categories ?? 0} 个分类、${data.links ?? 0} 条链接、${data.searchEngines ?? 0} 个搜索引擎`,
      );
      setPendingSnapshot(null);
      setPreview(null);
      setSelectedName(null);
      setConfirmOpen(false);
    } catch {
      toast("导入失败", "error");
    } finally {
      setImporting(false);
    }
  }

  function clearImport() {
    if (importing) return;
    setPendingSnapshot(null);
    setPreview(null);
    setSelectedName(null);
    setConfirmOpen(false);
  }

  return (
    <div>
      <AdminPageHeader
        title="数据导入导出"
        description="导出或导入配置 JSON（分类、链接、搜索引擎、站点设置）。不含上传图标与管理员密码。"
      />

      <div className="admin-export-grid">
        <section className="admin-form-card">
          <h2 className="admin-section-title">导出配置 JSON</h2>
          <p className="admin-form-hint" style={{ marginBottom: 8 }}>
            <strong>包含：</strong>链接、分类、搜索引擎、站点设置
          </p>
          <p className="admin-form-hint" style={{ marginBottom: 16 }}>
            <strong>不包含：</strong>本地上传图标、管理员密码、登录会话
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void exportJson()}
            disabled={exporting || importing}
          >
            {exporting ? "导出中…" : "导出 JSON"}
          </button>
        </section>

        <section className="admin-form-card">
          <h2 className="admin-section-title">导入配置 JSON</h2>
          <p className="admin-form-hint" style={{ marginBottom: 16 }}>
            选择 JSON 后先解析并预览数量与是否含站点设置；确认后才覆盖现有数据。管理员账号密码不变。
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            disabled={exporting || importing}
            onChange={(e) => void onPickFile(e.target.files?.[0])}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={exporting || importing}
              onClick={() => fileRef.current?.click()}
            >
              选择 JSON 文件
            </button>
            {selectedName ? (
              <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{selectedName}</span>
            ) : null}
            {pendingSnapshot ? (
              <button type="button" className="btn btn-ghost" onClick={clearImport} disabled={importing}>
                清除
              </button>
            ) : null}
          </div>

          {preview ? (
            <>
              <div className="admin-import-preview">
                <div className="admin-import-preview-item">
                  <div className="num">{preview.categories}</div>
                  <div className="lbl">分类</div>
                </div>
                <div className="admin-import-preview-item">
                  <div className="num">{preview.links}</div>
                  <div className="lbl">链接</div>
                </div>
                <div className="admin-import-preview-item">
                  <div className="num">{preview.searchEngines}</div>
                  <div className="lbl">搜索引擎</div>
                </div>
                <div className="admin-import-preview-item">
                  <div className="num" style={{ fontSize: 14 }}>
                    {preview.hasSiteSettings ? preview.siteName ?? "有" : "无"}
                  </div>
                  <div className="lbl">站点设置</div>
                </div>
              </div>
              <div className="alert alert-warning" style={{ marginBottom: 12 }}>
                确认后将<strong>覆盖</strong>现有分类、链接、搜索引擎与站点设置。此操作不可撤销。
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={importing}
                onClick={() => setConfirmOpen(true)}
              >
                继续导入…
              </button>
            </>
          ) : null}
        </section>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="确认恢复数据？"
        message="将用所选 JSON 覆盖全部分类、链接、搜索引擎与站点设置。管理员账号与密码不会改变。"
        confirmLabel="确认导入"
        busy={importing}
        onCancel={() => !importing && setConfirmOpen(false)}
        onConfirm={() => void confirmImport()}
      />
    </div>
  );
}
