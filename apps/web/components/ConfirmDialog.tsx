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
    <>
      <div className="overlay" onClick={busy ? undefined : onCancel} />
      <div className="form-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="form-dialog-panel form-dialog-panel--sm">
          <div className="form-dialog-header">
            <strong id="confirm-title">{title}</strong>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>
              关闭
            </button>
          </div>
          <div className="form-dialog-body">
            <p className="admin-form-hint" style={{ marginTop: 0, marginBottom: 0 }}>
              {message}
            </p>
          </div>
          <div className="form-dialog-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
              取消
            </button>
            <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
              {busy ? "处理中…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
