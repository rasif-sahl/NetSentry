"use client";

import { Mail } from "lucide-react";
import { useState } from "react";
import { api } from "@/shared/api";
import type { User } from "@/shared/types";
import { ActionButton } from "@/shared/ui/common";

export function EmailVerificationStripe({
  onChecked,
}: {
  onChecked: (user: User) => void;
}) {
  const [message, setMessage] = useState("");

  return (
    <section aria-label="Email verification" className="verification-stripe">
      <div className="verification-stripe-content">
        <div className="verification-stripe-message">
          <span className="verification-stripe-icon" aria-hidden="true">
            <Mail size={19} />
          </span>
          <div>
            <p>
              <strong>Verify your email</strong>
              <span className="verification-desktop-copy">
                {" "}
                to manage workspace access and monitoring.
              </span>
            </p>
            <div role="status">{message}</div>
          </div>
        </div>
        <div className="verification-stripe-actions">
          <ActionButton
            className="button primary"
            action={async () => {
              setMessage("");
              await api("/auth/verification/request", "POST", {});
              setMessage("Verification email requested. Check your inbox.");
            }}
          >
            <span className="verification-desktop-copy">
              Send verification email
            </span>
            <span className="verification-mobile-copy">Send email</span>
          </ActionButton>
          <ActionButton
            className="button accent"
            action={async () => {
              setMessage("");
              const user = await api<User>("/auth/me");
              onChecked(user);
              if (!user.emailVerifiedAt)
                setMessage("Email verification is still pending.");
            }}
          >
            <span className="verification-desktop-copy">
              I’ve verified my email
            </span>
            <span className="verification-mobile-copy">Check status</span>
          </ActionButton>
        </div>
      </div>
    </section>
  );
}
