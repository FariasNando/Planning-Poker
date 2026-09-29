type ConfirmDialogProps = {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label="Confirm action">
      <div className="confirm-box">
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className="confirm-cancel-button" onClick={onCancel}>Cancel</button>
          <button className="confirm-ok-button" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
