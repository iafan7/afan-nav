"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SoftRefreshHint } from "@/components/LoadingStates";
import { useToast } from "@/components/Toast";

type EngineOption = { id: string; name: string };

type Props = {
  initialSiteName: string;
  initialOwnerNickname: string;
  initialLinkCheckIntervalMinutes: number;
  initialDefaultSearchEngineId: string | null;
  engines: EngineOption[];
};

export function SettingsAdminClient({
  initialSiteName,
  initialOwnerNickname,
  initialLinkCheckIntervalMinutes,
  initialDefaultSearchEngineId,
  engines,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [siteName, setSiteName] = useState(initialSiteName);
  const [ownerNickname, setOwnerNickname] = useState(initialOwnerNickname);
  const [autoCheck, setAutoCheck] = useState(initialLinkCheckIntervalMinutes > 0);
  const [linkCheckIntervalMinutes, setLinkCheckIntervalMinutes] = useState(
    initialLinkCheckIntervalMinutes > 0 ? initialLinkCheckIntervalMinutes : 60,
  );
  const [defaultEngineId, setDefaultEngineId] = useState(initialDefaultSearchEngineId ?? "");
  const [savedName, setSavedName] = useState(initialSiteName);
  const [savedNickname, setSavedNickname] = useState(initialOwnerNickname);
  const [savedAutoCheck, setSavedAutoCheck] = useState(initialLinkCheckIntervalMinutes > 0);
  const [savedInterval, setSavedInterval] = useState(
    initialLinkCheckIntervalMinutes > 0 ? initialLinkCheckIntervalMinutes : 60,
  );
  const [savedDefaultEngineId, setSavedDefaultEngineId] = useState(
    initialDefaultSearchEngineId ?? "",
  );
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
    const on = initialLinkCheckIntervalMinutes > 0;
    setAutoCheck(on);
    setSavedAutoCheck(on);
    const interval = on ? initialLinkCheckIntervalMinutes : 60;
    setLinkCheckIntervalMinutes(interval);
    setSavedInterval(interval);
    setDefaultEngineId(initialDefaultSearchEngineId ?? "");
    setSavedDefaultEngineId(initialDefaultSearchEngineId ?? "");
  }, [
    initialSiteName,
    initialOwnerNickname,
    initialLinkCheckIntervalMinutes,
    initialDefaultSearchEngineId,
  ]);

  const effectiveInterval = autoCheck ? linkCheckIntervalMinutes : 0;
  const basicDirty =
    siteName.trim() !== savedName.trim() ||
    ownerNickname.trim() !== savedNickname.trim() ||
    defaultEngineId !== savedDefaultEngineId;
  const checkDirty =
    autoCheck !== savedAutoCheck || (autoCheck && linkCheckIntervalMinutes !== savedInterval);

  async function saveBasic() {
    if (!basicDirty || !siteName.trim() || !ownerNickname.trim() || saving) return;
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
          defaultSearchEngineId: defaultEngineId || null,
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
      setSavedDefaultEngineId(defaultEngineId);
      toast("设置已保存");
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  async function saveCheck() {
    if (!checkDirty || saving) return;
    if (
      autoCheck &&
      (!Number.isInteger(linkCheckIntervalMinutes) ||
        linkCheckIntervalMinutes < 1 ||
        linkCheckIntervalMinutes > 1440)
    ) {
      toast("检测间隔须为 1～1440 的整数分钟", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkCheckIntervalMinutes: effectiveInterval,
        }),
      });
      if (!res.ok) {
        toast("保存失败", "error");
        return;
      }
      setSavedAutoCheck(autoCheck);
      setSavedInterval(linkCheckIntervalMinutes);
      toast("设置已保存");
      startTransition(() => router.refresh());
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
      <AdminPageHeader title="站点设置" description="管理站点基础信息、链接检测与登录安全。" />

      <SoftRefreshHint show={isPending} />

      <div className="admin-settings-grid">
        <div className="admin-form-card">
          <h2>基础设置</h2>
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
            <label htmlFor="default-engine">默认搜索引擎</label>
            <select
              id="default-engine"
              className="select"
              value={defaultEngineId}
              onChange={(e) => setDefaultEngineId(e.target.value)}
            >
              {engines.length === 0 ? <option value="">暂无搜索引擎</option> : null}
              {engines.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void saveBasic()}
            disabled={saving || !basicDirty || !siteName.trim() || !ownerNickname.trim()}
          >
            {saving ? "保存中…" : "保存基础设置"}
          </button>
        </div>

        <div className="admin-form-card">
          <h2>检测设置</h2>
          <div className="admin-switch-row">
            <div className="label-block">
              <strong>自动检测</strong>
              <span>由服务端后台定时执行；关闭后仍可在链接页手动检测。</span>
            </div>
            <label className="admin-switch">
              <input
                type="checkbox"
                checked={autoCheck}
                onChange={(e) => setAutoCheck(e.target.checked)}
                aria-label="自动检测"
              />
              <span className="admin-switch-track" />
              <span className="admin-switch-text">{autoCheck ? "开启" : "关闭"}</span>
            </label>
          </div>
          <div className="field">
            <label htmlFor="link-check-interval">自动检测间隔（分钟）</label>
            <input
              id="link-check-interval"
              className="input"
              type="number"
              min={1}
              max={1440}
              step={1}
              disabled={!autoCheck}
              value={linkCheckIntervalMinutes}
              onChange={(e) => setLinkCheckIntervalMinutes(Number(e.target.value))}
            />
            <p className="admin-form-hint" style={{ marginTop: 6 }}>
              建议 60 分钟或更长。
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void saveCheck()}
            disabled={saving || !checkDirty}
          >
            {saving ? "保存中…" : "保存检测设置"}
          </button>
        </div>

        <div className="admin-form-card admin-security-card" style={{ gridColumn: "1 / -1" }}>
          <h2>安全设置</h2>
          <p className="admin-form-hint admin-security-desc">
            修改管理员登录密码（6～18 位）。修改成功后立即生效。
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
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
            </div>
          </div>
          {passwordError ? <div className="error" style={{ marginBottom: 12 }}>{passwordError}</div> : null}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void changePassword()}
            disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
          >
            {passwordSaving ? "修改中…" : "修改密码"}
          </button>
        </div>
      </div>
    </div>
  );
}
