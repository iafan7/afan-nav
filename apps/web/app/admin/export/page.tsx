"use client";

import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { useToast } from "@/components/Toast";

function exportFilename(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `linknest-export-${y}-${m}-${d}.json`;
}

export default function ExportAdminPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function exportJson() {
    if (loading) return;
    setLoading(true);
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
      setLoading(false);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="导出备份"
        description="下载 JSON 备份；不含管理员密码哈希与会话。"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => void exportJson()} disabled={loading}>
            {loading ? "导出中…" : "导出 JSON"}
          </button>
        }
      />
      <div className="alert alert-warning" style={{ maxWidth: 560 }}>
        导出文件包含<strong>隐藏分类</strong>与全部链接，请妥善保管。
      </div>
    </div>
  );
}
