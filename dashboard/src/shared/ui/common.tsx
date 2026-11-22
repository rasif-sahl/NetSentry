"use client";
import {
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type FormEvent,
} from "react";
import { ApiError } from "@/shared/api";
export { Loading } from "./loading";
export function Card({
  children,
  title,
  className = "",
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "error" | "success";
}) {
  return (
    <div
      className={`notice ${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <Notice tone="error">
      {error instanceof Error
        ? error.message
        : "Something went wrong. Please try again."}
      {error instanceof ApiError && error.details?.length ? (
        <ul>
          {error.details.map((detail, index) => (
            <li key={index}>{detail}</li>
          ))}
        </ul>
      ) : null}
      {error instanceof ApiError && error.requestId && (
        <small>Reference: {error.requestId}</small>
      )}
    </Notice>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const generatedId = useId();
  const control = isValidElement(children)
    ? (children as ReactElement<{ id?: string; "aria-describedby"?: string }>)
    : undefined;
  const id = control?.props.id ?? generatedId;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {control
        ? cloneElement(control, {
            id,
            ...(hint ? { "aria-describedby": id + "-hint" } : {}),
          })
        : children}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </div>
  );
}
export function ActionForm({
  children,
  action,
  submit = "Save changes",
  reset = false,
  className = "",
}: {
  children: ReactNode;
  action: (data: FormData) => Promise<string | void>;
  submit?: string;
  reset?: boolean;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const [message, setMessage] = useState("");
  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError(undefined);
    setMessage("");
    try {
      const message = await action(new FormData(form));
      setMessage(message ?? "Changes saved.");
      if (reset) form.reset();
    } catch (error) {
      setError(error);
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={handle} className={className} aria-busy={pending}>
      <fieldset disabled={pending} className="form-fields">
        {children}
        <button className="button primary" type="submit">
          {pending ? "Please wait…" : submit}
        </button>
      </fieldset>
      <ErrorNotice error={error} />
      {message && <Notice tone="success">{message}</Notice>}
    </form>
  );
}
export function ActionButton({
  children,
  action,
  confirm,
  className = "button",
  disabled = false,
}: {
  children: ReactNode;
  action: () => Promise<unknown>;
  confirm?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setPending(true);
    setError(undefined);
    try {
      await action();
    } catch (error) {
      setError(error);
    } finally {
      setPending(false);
    }
  }
  return (
    <span className="action">
      <button
        type="button"
        className={className}
        disabled={disabled || pending}
        onClick={run}
      >
        {pending ? "Please wait…" : children}
      </button>
      <ErrorNotice error={error} />
    </span>
  );
}
export function formatTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "Not reported";
}
export { text, number } from "../form-values";
