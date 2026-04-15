import AppIcon from "./AppIcon";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: "danger" | "primary";
  reverseActions?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmTone = "danger",
  reverseActions = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="upload-modal-overlay confirm-modal-overlay" onClick={busy ? undefined : onCancel}>
      <div className="upload-modal confirm-modal" onClick={(event) => event.stopPropagation()}>
        <div className="upload-modal-header">
          <h2 className="section-title-with-icon">
            <AppIcon name="approvals" className="section-title-icon" />
            <span>{title}</span>
          </h2>
        </div>
        <div className="upload-modal-body confirm-modal-body">
          <p>{message}</p>
          <div className="confirm-modal-actions">
            {reverseActions ? (
              <>
                <button
                  type="button"
                  className={`confirm-modal-confirm ${
                    confirmTone === "danger" ? "confirm-modal-confirm-danger" : ""
                  }`}
                  onClick={onConfirm}
                  disabled={busy}
                >
                  {busy ? "Please wait..." : confirmLabel}
                </button>
                <button
                  type="button"
                  className="confirm-modal-cancel"
                  onClick={onCancel}
                  disabled={busy}
                >
                  {cancelLabel}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="confirm-modal-cancel"
                  onClick={onCancel}
                  disabled={busy}
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  className={`confirm-modal-confirm ${
                    confirmTone === "danger" ? "confirm-modal-confirm-danger" : ""
                  }`}
                  onClick={onConfirm}
                  disabled={busy}
                >
                  {busy ? "Please wait..." : confirmLabel}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
