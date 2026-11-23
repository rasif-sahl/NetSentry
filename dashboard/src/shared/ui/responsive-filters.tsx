"use client";

import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { ActionFormDialog } from "./action-form-dialog";
import { ActionForm, Field, text } from "./common";

export function ResponsiveFilters({
  label,
  submit = "Apply filters",
  action,
  inline,
  beside,
  children,
}: {
  label: string;
  submit?: string;
  action: (form: FormData) => Promise<string | void>;
  inline?: ReactNode;
  beside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="flex items-center justify-end gap-2 min-[700px]:hidden">
        <ActionFormDialog
          label={label}
          submit={submit}
          icon={<SlidersHorizontal size={16} aria-hidden="true" />}
          mobileDrawer
          action={action}
        >
          {children}
        </ActionFormDialog>
        {beside}
      </div>
      <div className="max-[700px]:hidden">
        {inline ?? <ActionForm submit={submit} action={action}>{children}</ActionForm>}
      </div>
    </>
  );
}

export function ResponsiveSearch({
  title,
  label,
  value,
  onChange,
  placeholder,
  beside,
}: {
  title: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  beside?: ReactNode;
}) {
  const input = { type: "search", maxLength: 200, placeholder };
  return (
    <ResponsiveFilters
      label={title}
      beside={beside}
      action={async (form) => onChange(text(form, "search"))}
      inline={
        <Field label={label}>
          <input {...input} value={value} onChange={(event) => onChange(event.target.value)} />
        </Field>
      }
    >
      <Field label={label}>
        <input {...input} name="search" defaultValue={value} />
      </Field>
    </ResponsiveFilters>
  );
}
