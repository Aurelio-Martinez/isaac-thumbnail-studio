import { create } from "zustand";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export type ToastKind = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  action?: ToastAction;
  duration: number;
}

interface ToastState {
  toasts: ToastMessage[];
  push: (input: Omit<ToastMessage, "id" | "duration"> & { duration?: number }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let toastCounter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: ({ duration, ...input }) => {
    toastCounter += 1;
    const id = `toast-${toastCounter}`;
    set((state) => ({
      toasts: [
        ...state.toasts.slice(-4),
        { ...input, id, duration: duration ?? (input.kind === "error" ? 8000 : 4200) },
      ],
    }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

export const notify = {
  success(title: string, description?: string, action?: ToastAction) {
    useToastStore.getState().push({ kind: "success", title, description, action });
  },
  error(title: string, description?: string, action?: ToastAction) {
    useToastStore.getState().push({ kind: "error", title, description, action });
  },
  info(title: string, description?: string, action?: ToastAction) {
    useToastStore.getState().push({ kind: "info", title, description, action });
  },
};

const kindIcon = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const kindColor = {
  success: "text-emerald-400 border-emerald-800/60",
  error: "text-ember border-ember/40",
  info: "text-veil border-veil/40",
};

function ToastCard({ toast }: { toast: ToastMessage }) {
  const dismiss = useToastStore((state) => state.dismiss);
  const Icon = kindIcon[toast.kind];

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [dismiss, toast.id, toast.duration]);

  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border bg-ink-800/95 p-3 shadow-float backdrop-blur animate-toast-in",
        kindColor[toast.kind],
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-cream">{toast.title}</p>
        {toast.description ? (
          <p className="mt-1 text-[11px] leading-snug text-cream-dim">{toast.description}</p>
        ) : null}
        {toast.action ? (
          <button
            type="button"
            className="mt-2 text-[11px] font-semibold text-gold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-gold"
            onClick={() => {
              toast.action?.onClick();
              dismiss(toast.id);
            }}
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        className="rounded p-0.5 text-muted transition-colors hover:text-cream"
        onClick={() => dismiss(toast.id)}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[calc(100vw-32px)] flex-col items-end gap-2 sm:w-auto"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
