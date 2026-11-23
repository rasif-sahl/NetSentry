"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { ActionForm, Notice } from "./common";

export function ActionFormDialog({
  submit,
  label = submit,
  primary = false,
  mobileDrawer = false,
  icon,
  action,
  onOpen,
  onClose,
  children,
}: {
  submit: string;
  label?: string;
  primary?: boolean;
  mobileDrawer?: boolean;
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
        mobileDrawer
          ? 'button[aria-label="Close dialog"]'
          : 'form :is(input, select, textarea):not(:disabled, [type="hidden"])',
      )
      ?.focus();
  }, [open, mobileDrawer]);

  useEffect(() => {
    if (!open || !mobileDrawer) return;
    const previousOverflow = document.body.style.overflow;
    const wideScreen = window.matchMedia("(min-width: 700px)");
    const closeOnResize = () => {
      if (wideScreen.matches) dialog.current?.close();
    };
    document.body.style.overflow = "hidden";
    wideScreen.addEventListener("change", closeOnResize);
    closeOnResize();
    return () => {
      document.body.style.overflow = previousOverflow;
      wideScreen.removeEventListener("change", closeOnResize);
    };
  }, [open, mobileDrawer]);

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
        className={`fixed overflow-auto border border-border bg-surface p-4 text-text shadow-xl backdrop:bg-black/45 sm:p-6 ${
          mobileDrawer
            ? "inset-y-0 start-auto end-0 m-0 h-dvh max-h-none w-[calc(100%_-_1rem)] max-w-sm overscroll-contain rounded-s-2xl pb-[max(1rem,env(safe-area-inset-bottom))] motion-safe:animate-[workspace-drawer-enter_220ms_ease-out]"
            : "inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md rounded-2xl"
        }`}
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
