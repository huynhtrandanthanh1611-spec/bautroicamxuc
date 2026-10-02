import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function Modal({ title, children, onClose, wide = false }) {
  const dialog = useRef();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const node = dialog.current;
    node.showModal();
    const cancel = (e) => {
      e.preventDefault();
      close.current();
    };
    node.addEventListener("cancel", cancel);
    return () => {
      node.removeEventListener("cancel", cancel);
      node.close();
      previous?.focus?.();
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className={`modal ${wide ? "modal-wide" : ""}`}
      aria-labelledby="modal-title"
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="modal-inner">
        <header className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
          >
            <X size={22} />
          </button>
        </header>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
