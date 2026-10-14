"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="psi-login-page">
      <div className="psi-login-card">
        <div className="psi-auth-mark" aria-hidden="true">
          PSI
        </div>
        <p className="psi-kicker">YOUR COMMUNITY. YOUR FUTURE.</p>
        <h1>Welcome back</h1>
        <p className="psi-login-intro">
          Sign in to your PSI Savings Group account.
        </p>
        <form onSubmit={handleLogin} className="psi-login-form">
          <div>
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
              className="psi-auth-input"
            />
          </div>
          <div>
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              className="psi-auth-input"
            />
          </div>
          {error && (
            <p role="alert" className="psi-auth-error">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className="psi-auth-submit">
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        <p className="psi-login-note">
          Savings, financial records, and group conversations.
          <br />
          All in one place.
        </p>
      </div>
    </main>
  );
}
