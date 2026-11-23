"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { ActionForm, Notice } from "./common";

export function ActionFormDialog({
  submit,
  label = submit,
  primary = false,
  icon,
  action,
  onOpen,
  onClose,
  children,
}: {
  submit: string;
  label?: string;
  primary?: boolean;
  icon?: ReactNode;
  action: (form: FormData) => Promise<string | void>;
  onOpen?: () => void;
  onClose?: () => void;
  children: ReactNode;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    dialog.current
      ?.querySelector<HTMLElement>(
        'form :is(input, select, textarea):not(:disabled, [type="hidden"])',
      )
      ?.focus();
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        className={primary ? "button primary" : "button accent"}
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        {icon}
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onCancel={(event) => {
          if (saving) event.preventDefault();
        }}
        onClose={() => {
          setOpen(false);
          onClose?.();
          trigger.current?.focus();
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-auto rounded-2xl border border-border bg-surface p-4 text-text shadow-xl backdrop:bg-black/45 sm:p-6"
      >
        {open && (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id={titleId} className="text-lg font-semibold">
                {label}
              </h2>
              <button
                type="button"
                className="icon-button shrink-0"
                aria-label="Close dialog"
                disabled={saving}
                onClick={() => dialog.current?.close()}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <ActionForm
              submit={submit}
              action={async (form) => {
                setNotice("");
                setSaving(true);
                try {
                  const message = await action(form);
                  if (message) setNotice(message);
                  dialog.current?.close();
                } finally {
                  setSaving(false);
                }
              }}
            >
              {children}
            </ActionForm>
          </>
        )}
      </dialog>
      {notice && (
        <div className="mt-3 w-full">
          <Notice tone="success">{notice}</Notice>
        </div>
      )}
    </>
  );
}
