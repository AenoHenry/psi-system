"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createClient } from "@/lib/supabase/client";

export default function PasswordForm({
  recovery = false,
}: {
  recovery?: boolean;
}) {
  const [supabase] = useState(() => createClient());

  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const verification = useRef<Promise<string> | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!verification.current) {
      verification.current = (async () => {
        if (recovery) {
          const url = new URL(window.location.href);
          const token = url.searchParams.get("token_hash");
          const type = url.searchParams.get("type");

          // Remove the token from the address bar.
          window.history.replaceState(
            window.history.state,
            "",
            url.pathname,
          );

          if (!token || type !== "recovery") {
            throw new Error(
              "Open this page using the password reset email.",
            );
          }

          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: "recovery",
          });

          if (error || !data.user || !data.session) {
            throw new Error(
              "This reset link has expired or was already used. " +
                "Request a new one.",
            );
          }

          return data.user.id;
        }

        const { data, error } = await supabase.auth.getUser();

        if (error || !data.user) {
          throw new Error("Please log in again.");
        }

        return data.user.id;
      })();
    }

    verification.current
      .then((id) => {
        if (cancelled) return;

        setUserId(id);
        setChecking(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to verify your session.",
        );

        setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [recovery, supabase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy || !userId) return;

    setError("");

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }

    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user || data.user.id !== userId) {
        setUserId(null);

        throw new Error(
          "Your session changed or expired. No password was changed.",
        );
      }

      // Signed-in members must verify their current password.
      // Recovery users have already verified their email reset token.
      if (!recovery) {
        if (!data.user.email) {
          throw new Error("This account has no email address.");
        }

        const result = await supabase.auth.signInWithPassword({
          email: data.user.email,
          password: currentPassword,
        });

        if (result.error || result.data.user?.id !== userId) {
          throw new Error(
            "Your current password could not be verified.",
          );
        }
      }

      const result = await supabase.auth.updateUser({
        password,
      });

      if (result.error) {
        throw result.error;
      }

      setCurrentPassword("");
      setPassword("");
      setConfirmation("");
      setSuccess(true);

      const { error: logoutError } = await supabase.auth.signOut({
        scope: "local",
      });

      if (logoutError) {
        setError(
          "Your password was changed, but logout failed. " +
            "Use Log out before leaving this device.",
        );
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to change your password. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="psi-login-page">
      <div className="psi-login-card">
        <div className="psi-auth-mark" aria-hidden="true">
          PSI
        </div>

        <h1>
          {success
            ? "Password changed"
            : recovery
              ? "Reset password"
              : "Change password"}
        </h1>

        <p className="psi-login-intro">
          {success
            ? "Log in with your new password."
            : "Choose a unique password you do not use elsewhere."}
        </p>

        {checking && (
          <p role="status">Checking your secure session…</p>
        )}

        {error && (
          <p role="alert" className="psi-auth-error">
            {error}
          </p>
        )}

        {!checking && userId && !success && (
          <form onSubmit={submit} className="psi-login-form">
            {!recovery && (
              <div>
                <label htmlFor="current-password">
                  Current password
                </label>

                <input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={busy}
                  value={currentPassword}
                  onChange={(event) =>
                    setCurrentPassword(event.target.value)
                  }
                  className="psi-auth-input"
                />
              </div>
            )}

            <div>
              <label htmlFor="new-password">New password</label>

              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                disabled={busy}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="psi-auth-input"
              />
            </div>

            <div>
              <label htmlFor="confirm-password">
                Confirm new password
              </label>

              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                disabled={busy}
                value={confirmation}
                onChange={(event) =>
                  setConfirmation(event.target.value)
                }
                className="psi-auth-input"
              />
            </div>

            <p className="text-left text-sm text-gray-600">
              At least 8 characters. Additional account security
              requirements may apply. You will be logged out of this
              browser after saving.
            </p>

            <button
              type="submit"
              disabled={busy}
              className="psi-auth-submit"
            >
              {busy ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}

        <Link
          href={
            success || recovery || !userId
              ? "/login"
              : "/dashboard"
          }
          className="mt-6 inline-flex min-h-11 items-center font-semibold text-blue-700"
        >
          {success || recovery || !userId
            ? "Back to login"
            : "Back to dashboard"}
        </Link>

        {recovery && !checking && !userId && (
          <Link
            href="/forgot-password"
            className="block min-h-11 content-center font-semibold text-blue-700"
          >
            Request a new reset link
          </Link>
        )}
      </div>
    </main>
  );
}