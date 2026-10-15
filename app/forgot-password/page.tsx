"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);

    try {
      await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // Do not reveal whether this email belongs to an account.
    } finally {
      setSent(true);
      setBusy(false);
    }
  }

  return (
    <main className="psi-login-page">
      <div className="psi-login-card">
        <div className="psi-auth-mark" aria-hidden="true">
          PSI
        </div>

        <h1>Forgot password?</h1>

        <p className="psi-login-intro">
          Enter the email linked to your PSI account.
        </p>

        {sent ? (
          <div
            role="status"
            className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-left text-blue-900"
          >
            If an account exists and the request can be processed, you will
            receive a password reset email. Check your spam folder too. If
            nothing arrives, wait a few minutes and try again or contact the
            Chairperson.
          </div>
        ) : (
          <form onSubmit={submit} className="psi-login-form">
            <div>
              <label htmlFor="recovery-email">Email address</label>

              <input
                id="recovery-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={busy}
                className="psi-auth-input"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="psi-auth-submit"
            >
              {busy ? "Requesting link…" : "Send reset link"}
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="mt-6 inline-flex min-h-11 items-center font-semibold text-blue-700"
        >
          Back to login
        </Link>
      </div>
    </main>
  );
}