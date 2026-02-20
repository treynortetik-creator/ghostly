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
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
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
      <CheckCircle className="w-5 h-5 text-ink-green" />
    ) : toast.type === "error" ? (
      <XCircle className="w-5 h-5 text-ink-red" />
    ) : (
      <AlertTriangle className="w-5 h-5 text-ink-gold" />
    );

  return (
    <div className="flex items-center gap-3 rounded-lg border border-wood-medium/40 bg-parchment px-4 py-3 shadow-lg dark:border-wood-medium dark:bg-parchment-dark animate-slide-in-right">
      {icon}
      <span className="text-sm text-ink-black flex-1">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="text-sepia/50 hover:text-sepia"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
