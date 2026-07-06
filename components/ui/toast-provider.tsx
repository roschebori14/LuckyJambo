"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { X, MessageCircle, Bell } from "lucide-react";
import { useSound } from "@/lib/sound/sound-manager";

export interface ToastInput {
  title: string;
  message: string;
  href?: string;
  icon?: "message" | "bell";
  durationMs?: number;
  /** Set true if the caller already played its own sound (e.g. the DM
   *  listener plays "message-received" itself) so this doesn't also
   *  play the generic notification sound on top of it. */
  silent?: boolean;
}

interface Toast extends ToastInput {
  id: string;
}

interface ToastContextValue {
  pushToast: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue>({
  pushToast: () => {},
});

/**
 * Lightweight, dependency-free toast system. Mount once near the root
 * of the authenticated app (see (protected)/layout.tsx) and call
 * `useToast().pushToast(...)` from anywhere - e.g. the DM realtime
 * listener uses this to surface an incoming message immediately,
 * regardless of which page the recipient is currently looking at.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();

  const { play } = useSound();

  const pushToast = useCallback((toast: ToastInput) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    if (!toast.silent) play("notification");
    const duration = toast.durationMs ?? 6000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, [play]);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div
        className="fixed top-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            onClick={() => {
              if (toast.href) router.push(toast.href);
              dismiss(toast.id);
            }}
            className="animate-[toast-in_0.2s_ease-out] flex items-start gap-3 rounded-2xl border p-4 shadow-lg backdrop-blur"
            style={{
              background: "var(--lj-card-2)",
              borderColor: "var(--lj-border)",
              cursor: toast.href ? "pointer" : "default",
            }}
          >
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
              style={{ background: "rgba(45,127,255,0.15)", color: "var(--lj-blue-2)" }}
            >
              {toast.icon === "bell" ? <Bell size={16} /> : <MessageCircle size={16} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{toast.title}</p>
              <p className="line-clamp-2 text-sm text-[var(--lj-muted)]">{toast.message}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismiss(toast.id);
              }}
              className="flex-shrink-0 rounded-lg p-1 text-[var(--lj-muted)] hover:bg-white/10 hover:text-white"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
