"use client";

import { useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
};

export function LinkIconField({ value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  async function onPick(file: File | undefined) {
    if (!file || disabled) return;
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/admin/uploads/link-icon", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(data.error ?? "上传失败");
        return;
      }
      if (typeof data.url !== "string") {
        setUploadError("上传响应无效");
        return;
      }
      setPreviewFailed(false);
      onChange(data.url);
    } catch {
      setUploadError("上传失败");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="field">
      <label htmlFor="link-icon">图标</label>
      <div className="link-icon-field">
        <div className="link-icon-preview" aria-hidden={!value}>
          {value && !previewFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt=""
              width={40}
              height={40}
              onError={() => setPreviewFailed(true)}
            />
          ) : (
            <span className="link-icon-preview-empty">无</span>
          )}
        </div>
        <div className="link-icon-controls">
          <input
            id="link-icon"
            className="input"
            placeholder="https://… 或上传本地图片"
            value={value}
            disabled={disabled || uploading}
            onChange={(e) => {
              setPreviewFailed(false);
              setUploadError(null);
              onChange(e.target.value);
            }}
          />
          <div className="link-icon-actions">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
              hidden
              disabled={disabled || uploading}
              onChange={(e) => void onPick(e.target.files?.[0])}
            />
            <button
              type="button"
              className="btn btn-secondary"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? "上传中…" : "上传图片"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={disabled || uploading || !value}
              onClick={() => {
                setPreviewFailed(false);
                setUploadError(null);
                onChange("");
              }}
            >
              清除
            </button>
          </div>
          <p className="admin-form-hint">支持 PNG / JPG / WEBP，最大 2MB；也可填写外部图标 URL。</p>
          {uploadError ? <div className="error">{uploadError}</div> : null}
        </div>
      </div>
    </div>
  );
}
