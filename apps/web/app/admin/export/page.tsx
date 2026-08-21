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

export default function ExportAdminPage() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingSnapshot, setPendingSnapshot] = useState<unknown>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);

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
      setPendingSnapshot(parsed);
      setSelectedName(file.name);
    } catch {
      toast("无法解析 JSON 文件", "error");
      setPendingSnapshot(null);
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
      setSelectedName(null);
    } catch {
      toast("导入失败", "error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="备份导入"
        description="导出或导入 JSON 备份；不含管理员密码哈希与会话。"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void exportJson()}
            disabled={exporting || importing}
          >
            {exporting ? "导出中…" : "导出 JSON"}
          </button>
        }
      />

      <div className="alert alert-warning" style={{ maxWidth: 560, marginBottom: 16 }}>
        导出文件包含<strong>私有分类</strong>与全部链接，请妥善保管。本地上传的图标文件不在
        JSON 内，需另行备份 <code>data/uploads/link-icons</code>。
      </div>

      <section className="admin-form-card" style={{ maxWidth: 560 }}>
        <h2 className="admin-section-title">导入 JSON</h2>
        <p className="admin-form-hint" style={{ marginBottom: 16 }}>
          将用所选备份<strong>完整覆盖</strong>分类、链接、搜索引擎与站点设置；管理员账号密码不变。
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
        </div>
      </section>

      <ConfirmDialog
        open={pendingSnapshot != null}
        title="确认导入备份？"
        message="将覆盖全部分类、链接、搜索引擎与站点设置。管理员账号与密码不会改变。此操作不可撤销。"
        confirmLabel="确认导入"
        busy={importing}
        onCancel={() => {
          if (!importing) {
            setPendingSnapshot(null);
            setSelectedName(null);
          }
        }}
        onConfirm={() => void confirmImport()}
      />
    </div>
  );
}
