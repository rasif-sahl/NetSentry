"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { api, beginSession } from "@/shared/api";
import type { User } from "@/shared/types";
import {
  ActionForm,
  Field,
  Notice,
  PasswordField,
  text,
} from "@/shared/ui/common";
export type AuthMode = "login" | "register" | "forgot" | "verify" | "reset";
export function AuthPanel({
  onSignedIn,
  initialMode = "login",
  notice,
}: {
  onSignedIn: (user: User) => void;
  initialMode?: AuthMode;
  notice?: string;
}) {
  const [mode, setMode] = useState(initialMode);
  const tokenInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("token");
    if (token) {
      if (tokenInput.current) tokenInput.current.value = token;
      history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  const titles = {
    login: "Welcome back",
    register: "Create your account",
    forgot: "Reset your password",
    verify: "Verify your email",
    reset: "Choose a new password",
  };
  return (
    <main className="auth-layout">
      <div className="auth-story">
        <Link className="brand" href="/">
          ◈ NetSentry
        </Link>
        <p className="eyebrow">YOUR WORKSPACE, IN VIEW</p>
        <h1>
          A clearer view.
          <br />A calmer day.
        </h1>
        <p>
          Keep your devices, reported usage and important alerts together,
          wherever you work.
        </p>
        <div className="auth-note">
          Monitoring depends on device permissions and supported collectors.
          Your dashboard shows what is available.
        </div>
      </div>
      <section className="auth-card">
        <span className="eyebrow">NETSENTRY ACCOUNT</span>
        <h2>{titles[mode]}</h2>
        {notice && <Notice>{notice}</Notice>}
        <ActionForm
          key={mode}
          submit={
            {
              login: "Sign in",
              register: "Create account",
              forgot: "Request reset link",
              verify: "Verify email",
              reset: "Reset password",
            }[mode]
          }
          action={async (form) => {
            if (mode === "login" || mode === "register") {
              const result = await api<{ user: User }>(
                `/auth/${mode === "login" ? "login" : "register"}`,
                "POST",
                {
                  email: text(form, "email"),
                  password: String(form.get("password")),
                  ...(mode === "register"
                    ? { displayName: text(form, "displayName") }
                    : {}),
                },
              );
              beginSession(result.user.id);
              onSignedIn(result.user);
              return;
            }
            if (mode === "forgot") {
              await api("/auth/password/forgot", "POST", {
                email: text(form, "email"),
              });
              return "If an account exists, check your email for a reset link.";
            }
            if (mode === "verify") {
              await api("/auth/verification/confirm", "POST", {
                token: text(form, "token"),
              });
              if (tokenInput.current) tokenInput.current.value = "";
              return "Email verified. You can now sign in and manage your workspace.";
            }
            if (
              String(form.get("password")) !==
              String(form.get("confirmPassword"))
            )
              throw new Error("The passwords do not match.");
            await api("/auth/password/reset", "POST", {
              token: text(form, "token"),
              password: String(form.get("password")),
            });
            if (tokenInput.current) tokenInput.current.value = "";
            return "Password reset. Sign in with your new password.";
          }}
        >
          {mode === "register" && (
            <Field label="Your name">
              <input
                name="displayName"
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
              />
            </Field>
          )}
          {["login", "register", "forgot"].includes(mode) && (
            <Field label="Email address">
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </Field>
          )}
          {["verify", "reset"].includes(mode) && (
            <Field
              label={mode === "verify" ? "Verification code" : "Reset code"}
              hint="Filled from your email link. You can paste the code here if needed."
            >
              <input
                type="password"
                name="token"
                required
                pattern="[A-Za-z0-9_-]{43}"
                ref={tokenInput}
                autoComplete="off"
              />
            </Field>
          )}
          {["login", "register", "reset"].includes(mode) && (
            <PasswordField
              label="Password"
              hint={mode !== "login" ? "Use 12–128 characters." : undefined}
              name="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "login" ? 1 : 12}
              maxLength={128}
              required
            />
          )}
          {mode === "reset" && (
            <PasswordField
              label="Confirm new password"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          )}
        </ActionForm>
        <nav className="auth-links" aria-label="Account options">
          {mode !== "login" && (
            <button onClick={() => setMode("login")}>Back to sign in</button>
          )}
          {mode === "login" && (
            <>
              <button onClick={() => setMode("register")}>
                Create an account
              </button>
              <button onClick={() => setMode("forgot")}>
                Forgot password?
              </button>
            </>
          )}
          {mode === "forgot" && (
            <button onClick={() => setMode("reset")}>
              I have a reset token
            </button>
          )}
        </nav>
      </section>
    </main>
  );
}
