"use client";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "确认删除",
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="overlay" onClick={busy ? undefined : onCancel} />
      <div className="dialog-panel" style={{ position: "relative", zIndex: 61 }}>
        <h2 id="confirm-title" style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600 }}>
          {title}
        </h2>
        <p style={{ margin: "0 0 20px", color: "var(--color-text-secondary)" }}>{message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? "处理中…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
