import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AppIcon from "../components/AppIcon";

export type ToastType = "success" | "error" | "info";

type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

type ToastProviderProps = {
  children: ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", durationMs = 3600) => {
      const trimmed = message.trim();
      if (!trimmed) {
        return;
      }

      const id = Date.now() + Math.floor(Math.random() * 10000);
      setToasts((prev) => [...prev, { id, type, message: trimmed }]);

      if (durationMs > 0 && typeof window !== "undefined") {
        window.setTimeout(() => dismissToast(id), durationMs);
      }
    },
    [dismissToast]
  );

  const value = useMemo(
    () => ({
      showToast,
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <article key={toast.id} className={`toast-item toast-item-${toast.type}`}>
            <div className="toast-item-content">
              <span className="toast-item-icon" aria-hidden="true">
                <AppIcon
                  name={
                    toast.type === "success"
                      ? "approvals"
                      : toast.type === "error"
                        ? "logout"
                        : "notifications"
                  }
                  size={14}
                />
              </span>
              <p>{toast.message}</p>
            </div>
            <button
              type="button"
              className="toast-item-close"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </article>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }
  return context;
}

