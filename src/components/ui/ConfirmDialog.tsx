"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Trash2, HelpCircle } from "lucide-react";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  const icon =
    variant === "danger" ? (
      <Trash2 className="w-6 h-6 text-ink-red" />
    ) : variant === "warning" ? (
      <AlertTriangle className="w-6 h-6 text-ink-gold" />
    ) : (
      <HelpCircle className="w-6 h-6 text-wood-dark dark:text-ink-black" />
    );

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto max-w-md rounded-lg border border-wood-medium/40 bg-parchment p-0 shadow-xl backdrop:bg-black/50 dark:border-wood-medium dark:bg-parchment-dark"
      onClose={onCancel}
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 mt-0.5">{icon}</div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-wood-dark dark:text-ink-black font-[family-name:var(--font-playfair)]">
              {title}
            </h3>
            <p className="mt-2 text-sm text-sepia">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "destructive" : "primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
