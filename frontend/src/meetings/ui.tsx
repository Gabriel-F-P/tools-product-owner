import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  children,
  onClose,
  footer,
  wide = false
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="mt-modal-backdrop" onMouseDown={onClose} role="presentation">
      <div
        aria-modal="true"
        className={`mt-modal ${wide ? "wide" : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header>
          <h2>{title}</h2>
          <button aria-label="Fechar" className="mt-icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>
        <div className="mt-modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancelar",
  danger = false,
  onConfirm,
  onCancel
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="mt-btn ghost" onClick={onCancel} type="button">{cancelLabel}</button>
          <button className={`mt-btn ${danger ? "danger" : "primary"}`} onClick={onConfirm} type="button">{confirmLabel}</button>
        </>
      }
    >
      <p className="mt-confirm-text">{message}</p>
    </Modal>
  );
}
