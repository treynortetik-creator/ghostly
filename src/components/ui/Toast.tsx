"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, X } from "lucide-react";

interface ToastMessage {
  id: number;
  type: "success" | "error" | "warning";
  message: string;
}

let nextId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (type: ToastMessage["type"], message: string) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, type, message }]);
    },
    [],
  );

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (message: string) => addToast("success", message),
    error: (message: string) => addToast("error", message),
    warning: (message: string) => addToast("warning", message),
  };

  return { toasts, removeToast, toast };
}

export function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: ToastMessage[];
  removeToast: (id: number) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" role="alert" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const icon =
    toast.type === "success" ? (
      <CheckCircle className="w-5 h-5 text-emerald-400" />
    ) : toast.type === "error" ? (
      <XCircle className="w-5 h-5 text-red-400" />
    ) : (
      <AlertTriangle className="w-5 h-5 text-amber-400" />
    );

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lg glass-shadow animate-slide-in-right">
      {icon}
      <span className="text-sm text-foreground flex-1">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="text-muted-foreground/50 hover:text-muted-foreground"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
