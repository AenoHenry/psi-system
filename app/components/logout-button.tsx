"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  useTransition,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { logout } from "@/app/auth/actions";

export default function LogoutButton() {
  const [supabase] = useState(() => createClient());
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSignedIn(Boolean(session));
      },
    );

    return () => {
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  function handleLogout() {
    if (pending) return;

    setError("");

    startTransition(async () => {
      const result = await logout();

      if (result?.error) {
        setError(result.error);
      }
    });
  }

  if (!signedIn) return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <Link
        href="/account"
        className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-blue-700"
      >
        Password
      </Link>

      <button
        type="button"
        onClick={handleLogout}
        disabled={pending}
        aria-busy={pending}
        className="min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Logging out…" : "Log out"}
      </button>

      {error && (
        <p
          role="alert"
          className="max-w-48 text-right text-sm text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}