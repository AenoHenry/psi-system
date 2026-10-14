"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ActivatePage() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [invitedUserId, setInvitedUserId] = useState<string | null>(null);

  // Avoid consuming the same invitation twice when React
  // runs effects twice during development.
  const verificationRef = useRef<Promise<string> | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!verificationRef.current) {
      verificationRef.current = (async () => {
        const url = new URL(window.location.href);
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");

        if (!tokenHash || type !== "invite") {
          throw new Error(
            "Open this page using the invitation email. " +
              "Opening /activate directly will not activate an account.",
          );
        }

        // Verify this specific invitation instead of accepting
        // whichever account is already signed in.
        const { data, error: verificationError } =
          await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "invite",
          });

        if (verificationError || !data.user || !data.session) {
          throw new Error(
            "This invitation could not be verified. " +
              "It may be expired or already used. " +
              "Ask the chairperson for help.",
          );
        }

        // Remove the invitation token from the address bar.
        url.searchParams.delete("token_hash");
        url.searchParams.delete("type");

        window.history.replaceState(
          window.history.state,
          "",
          `${url.pathname}${url.search}${url.hash}`,
        );

        return data.user.id;
      })();
    }

    verificationRef.current
      .then((userId) => {
        if (cancelled) return;

        setInvitedUserId(userId);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to verify this invitation.",
        );

        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleActivate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || !invitedUserId) return;

    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      // Confirm the session still belongs to the invited user.
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user || user.id !== invitedUserId) {
        setInvitedUserId(null);

        throw new Error(
          "Your login session changed or expired. " +
            "For safety, no password was changed. " +
            "Ask the chairperson for help.",
        );
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        throw updateError;
      }

      setPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to set your password.",
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClassName =
    "w-full rounded-lg border border-gray-300 bg-white " +
    "px-4 py-3 text-gray-900 outline-none " +
    "focus:border-blue-700 focus:ring-1 focus:ring-blue-700 " +
    "disabled:bg-gray-100";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-gray-600">Checking your invitation…</p>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-green-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Password Set Successfully
          </h1>

          <p className="mt-3 text-gray-600">Your PSI login is ready.</p>

          <button
            type="button"
            onClick={() => {
              router.replace("/dashboard");
              router.refresh();
            }}
            className="mt-6 w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800"
          >
            Go to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            PSI Savings Group
          </h1>

          <p className="mt-2 text-gray-600">Set up your member login</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            {invitedUserId ? "Set Your Password" : "Invitation Required"}
          </h2>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4"
            >
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {invitedUserId ? (
            <form onSubmit={handleActivate} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  New Password
                </label>

                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                  disabled={saving}
                  className={inputClassName}
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Confirm Password
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={8}
                  required
                  disabled={saving}
                  className={inputClassName}
                />
              </div>

              <p className="text-sm text-gray-500">
                Use at least 8 characters. Both passwords must match. Additional
                Supabase password requirements may also apply.
              </p>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving Password…" : "Set Password"}
              </button>
            </form>
          ) : (
            <p className="mt-6 text-sm text-gray-600">
              Already set your password?{" "}
              <Link href="/login" className="font-semibold underline">
                Go to Login
              </Link>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
