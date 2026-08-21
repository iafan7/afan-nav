"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SoftRefreshHint } from "@/components/LoadingStates";
import { useToast } from "@/components/Toast";

type Props = {
  initialSiteName: string;
  initialOwnerNickname: string;
  initialLinkCheckIntervalMinutes: number;
};

export function SettingsAdminClient({
  initialSiteName,
  initialOwnerNickname,
  initialLinkCheckIntervalMinutes,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [siteName, setSiteName] = useState(initialSiteName);
  const [ownerNickname, setOwnerNickname] = useState(initialOwnerNickname);
  const [linkCheckIntervalMinutes, setLinkCheckIntervalMinutes] = useState(
    initialLinkCheckIntervalMinutes,
  );
  const [savedName, setSavedName] = useState(initialSiteName);
  const [savedNickname, setSavedNickname] = useState(initialOwnerNickname);
  const [savedInterval, setSavedInterval] = useState(initialLinkCheckIntervalMinutes);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    setSiteName(initialSiteName);
    setSavedName(initialSiteName);
    setOwnerNickname(initialOwnerNickname);
    setSavedNickname(initialOwnerNickname);
    setLinkCheckIntervalMinutes(initialLinkCheckIntervalMinutes);
    setSavedInterval(initialLinkCheckIntervalMinutes);
  }, [initialSiteName, initialOwnerNickname, initialLinkCheckIntervalMinutes]);

  const dirty =
    siteName.trim() !== savedName.trim() ||
    ownerNickname.trim() !== savedNickname.trim() ||
    linkCheckIntervalMinutes !== savedInterval;

  async function save() {
    if (!dirty || !siteName.trim() || !ownerNickname.trim() || saving) return;
    if (
      !Number.isInteger(linkCheckIntervalMinutes) ||
      linkCheckIntervalMinutes < 0 ||
      linkCheckIntervalMinutes > 1440
    ) {
      toast("检测间隔须为 0～1440 的整数分钟", "error");
      return;
    }
    setSaving(true);
    const nextName = siteName.trim();
    const nextNickname = ownerNickname.trim();
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName: nextName,
          ownerNickname: nextNickname,
          linkCheckIntervalMinutes,
        }),
      });
      if (!res.ok) {
        toast("保存失败", "error");
        return;
      }
      setSiteName(nextName);
      setSavedName(nextName);
      setOwnerNickname(nextNickname);
      setSavedNickname(nextNickname);
      setSavedInterval(linkCheckIntervalMinutes);
      toast("站点设置已保存");
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (passwordSaving) return;
    setPasswordError(null);
    setPasswordSaving(true);
    try {
      const res = await fetch("/api/admin/security/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setPasswordError(data.error ?? "密码修改失败，请稍后重试");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast("密码修改成功，新密码已立即生效");
    } catch {
      setPasswordError("密码修改失败，请稍后重试");
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="站点设置"
        description="站点名称与站长称呼会显示在前台；默认搜索引擎请到「搜索引擎」页设置。"
      />

      <SoftRefreshHint show={isPending} />

      <div className="admin-form-card">
        <div className="field">
          <label htmlFor="site-name">站点名称 *</label>
          <input
            id="site-name"
            className="input"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="owner-nickname">站长称呼 *</label>
          <input
            id="owner-nickname"
            className="input"
            value={ownerNickname}
            onChange={(e) => setOwnerNickname(e.target.value)}
            placeholder="例如：阿凡"
          />
          <p className="admin-form-hint" style={{ marginTop: 6 }}>
            前台欢迎语显示为「早上好，{ownerNickname.trim() || "…"}」。
          </p>
        </div>
        <div className="field">
          <label htmlFor="link-check-interval">链接自动检测间隔（分钟）</label>
          <input
            id="link-check-interval"
            className="input"
            type="number"
            min={0}
            max={1440}
            step={1}
            value={linkCheckIntervalMinutes}
            onChange={(e) => setLinkCheckIntervalMinutes(Number(e.target.value))}
          />
          <p className="admin-form-hint" style={{ marginTop: 6 }}>
            默认 60 分钟；设为 0 可关闭自动检测。由服务端后台定时执行，无需打开链接管理页。
          </p>
        </div>
        <p className="admin-form-hint">默认搜索引擎权威字段：site_settings.default_search_engine_id。</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void save()}
          disabled={saving || !dirty || !siteName.trim() || !ownerNickname.trim()}
        >
          {saving ? "保存中…" : "保存"}
        </button>
      </div>

      <div className="admin-form-card admin-security-card">
        <h2 className="admin-section-title">安全设置</h2>
        <p className="admin-form-hint admin-security-desc">
          修改管理员登录密码（6～18 位）。修改成功后，新密码立即生效。
        </p>
        <div className="field">
          <label htmlFor="current-password">当前密码</label>
          <input
            id="current-password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => {
              setPasswordError(null);
              setCurrentPassword(e.target.value);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="new-password">新密码</label>
          <input
            id="new-password"
            className="input"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => {
              setPasswordError(null);
              setNewPassword(e.target.value);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="confirm-password">确认新密码</label>
          <input
            id="confirm-password"
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => {
              setPasswordError(null);
              setConfirmPassword(e.target.value);
            }}
          />
          {passwordError ? <div className="error">{passwordError}</div> : null}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void changePassword()}
          disabled={
            passwordSaving || !currentPassword || !newPassword || !confirmPassword
          }
        >
          {passwordSaving ? "修改中…" : "修改密码"}
        </button>
      </div>
    </div>
  );
}
