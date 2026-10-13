"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export default function AddMemberPage() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setMessage("");
    setWarning("");
    setError("");

    try {
      const response = await fetch("/api/members/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          role,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to create member."
        );
      }

      const memberNumber = result.member?.member_number;

      setMessage(
        memberNumber
          ? `Member created successfully. PSI number: ${memberNumber}.`
          : "Member created successfully."
      );

      // Display invitation information only when the
      // backend explicitly reports it.
      if (result.warning) {
        setWarning(result.warning);
      } else if (result.message) {
        setMessage((current) => `${current} ${result.message}`);
      }

      setFullName("");
      setPhone("");
      setEmail("");
      setRole("member");
    } catch (err) {
      console.error("CREATE MEMBER ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create member."
      );
    } finally {
      setLoading(false);
    }
  }

  const inputClassName =
    "w-full rounded-lg border border-gray-300 bg-white px-4 py-3 " +
    "text-gray-900 outline-none focus:border-gray-700 " +
    "focus:ring-1 focus:ring-gray-700 disabled:bg-gray-100";

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/members"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            ← Back to Members
          </Link>

          <h1 className="mt-4 text-3xl font-bold text-gray-900">
            Add PSI Member
          </h1>

          <p className="mt-2 text-gray-600">
            Add a new member and invite them to set up their login.
          </p>
        </div>

        {/* Success */}
        {message && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-green-200 bg-green-50 p-5"
          >
            <h2 className="font-semibold text-green-800">
              Member Created
            </h2>

            <p className="mt-2 text-sm text-green-700">
              {message}
            </p>

            <Link
              href="/members"
              className="mt-4 inline-block rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
            >
              View Members
            </Link>
          </div>
        )}

        {/* Invitation warning */}
        {warning && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5"
          >
            <h2 className="font-semibold text-amber-900">
              Invitation Needs Attention
            </h2>

            <p className="mt-2 text-sm text-amber-800">
              {warning}
            </p>

            <p className="mt-2 text-sm text-amber-800">
              The member was created. Do not submit them again.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5"
          >
            <h2 className="font-semibold text-red-800">
              Could Not Create Member
            </h2>

            <p className="mt-2 text-sm text-red-700">
              {error}
            </p>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8"
        >
          <fieldset disabled={loading} className="min-w-0">
            {/* Personal information */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900">
                Member Information
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Enter the member&apos;s basic PSI information.
              </p>

              <div className="mt-6 space-y-5">
                <div>
                  <label
                    htmlFor="fullName"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Full Name
                  </label>

                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) =>
                      setFullName(event.target.value)
                    }
                    placeholder="e.g. John Kamau"
                    required
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Phone Number
                  </label>

                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) =>
                      setPhone(event.target.value)
                    }
                    placeholder="e.g. 0712345678"
                    required
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Email Address
                  </label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="e.g. john@example.com"
                    required
                    className={inputClassName}
                  />

                  <p className="mt-2 text-xs text-gray-500">
                    Use an email address the member can access.
                  </p>
                </div>
              </div>
            </section>

            {/* PSI role */}
            <section className="mt-8 border-t border-gray-200 pt-8">
              <h2 className="text-lg font-semibold text-gray-900">
                PSI Role
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Choose the member&apos;s role in PSI.
              </p>

              <div className="mt-5">
                <label
                  htmlFor="role"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Role
                </label>

                <select
                  id="role"
                  name="role"
                  value={role}
                  onChange={(event) =>
                    setRole(event.target.value)
                  }
                  className={inputClassName}
                >
                  <option value="member">Member</option>
                  <option value="secretary">Secretary</option>
                  <option value="treasurer">Treasurer</option>
                </select>

                <p className="mt-2 text-xs text-gray-500">
                  The Chairperson role cannot be assigned from
                  this form.
                </p>
              </div>
            </section>

            {/* Invitation replaces temporary password */}
            <section className="mt-8 border-t border-gray-200 pt-8">
              <h2 className="text-lg font-semibold text-gray-900">
                Member Invitation
              </h2>

              <p className="mt-2 text-sm text-gray-600">
                The member will receive an invitation email
                and set their own password. You do not need
                to create or share a password.
              </p>
            </section>

            {/* Submit */}
            <div className="mt-8 border-t border-gray-200 pt-8">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gray-900 px-5 py-3 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Creating Member..."
                  : "Create PSI Member"}
              </button>
            </div>
          </fieldset>
        </form>

        {/* Security notice */}
        <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-semibold text-blue-900">
            Chairperson Access
          </h2>

          <p className="mt-1 text-sm text-blue-800">
            Only the PSI Chairperson is permitted to add
            members. The server checks the Chairperson&apos;s
            role and active membership before creating an account.
          </p>
        </div>
      </div>
    </main>
  );
}