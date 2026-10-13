"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Member = {
  id: string;
  member_number: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  join_date: string;
};

type Contribution = {
  id: string;
  amount: number;
  contribution_date: string;
  payment_method: string | null;
  mpesa_reference: string | null;
  notes: string | null;
};

type Loan = {
  id: string;
  principal_amount: number;
  interest_rate: number;
  interest_amount: number;
  total_amount: number;
  amount_paid: number;
  balance: number;
  application_date: string | null;
  due_date: string | null;
  status: string;
  purpose: string | null;
};

export default function MemberProfilePage() {
  const params = useParams();
  const memberId = params.id as string;

  const supabase = createClient();

  const [member, setMember] = useState<Member | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editStatus, setEditStatus] = useState("");

  useEffect(() => {
    if (memberId) {
      loadMember();
    }
  }, [memberId]);

  async function loadMember() {
    try {
      setLoading(true);
      setError("");

      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select(
          "id, member_number, full_name, email, phone, role, status, join_date"
        )
        .eq("id", memberId)
        .single();

      if (memberError) {
        throw memberError;
      }

      const { data: contributionData, error: contributionError } =
        await supabase
          .from("contributions")
          .select(
            "id, amount, contribution_date, payment_method, mpesa_reference, notes"
          )
          .eq("member_id", memberId)
          .order("contribution_date", { ascending: false });

      if (contributionError) {
        throw contributionError;
      }

      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .select(
          "id, principal_amount, interest_rate, interest_amount, total_amount, amount_paid, balance, application_date, due_date, status, purpose"
        )
        .eq("member_id", memberId)
        .order("application_date", { ascending: false });

      if (loanError) {
        throw loanError;
      }

      setMember(memberData);
      setContributions(contributionData ?? []);
      setLoans(loanData ?? []);

      setEditName(memberData.full_name);
      setEditEmail(memberData.email ?? "");
      setEditPhone(memberData.phone ?? "");
      setEditRole(memberData.role);
      setEditStatus(memberData.status);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load member information."
      );
    } finally {
      setLoading(false);
    }
  }

  function startEditing() {
    if (!member) return;

    setEditName(member.full_name);
    setEditEmail(member.email ?? "");
    setEditPhone(member.phone ?? "");
    setEditRole(member.role);
    setEditStatus(member.status);

    setSuccessMessage("");
    setError("");
    setEditing(true);
  }

  function cancelEditing() {
    if (!member) return;

    setEditName(member.full_name);
    setEditEmail(member.email ?? "");
    setEditPhone(member.phone ?? "");
    setEditRole(member.role);
    setEditStatus(member.status);

    setError("");
    setEditing(false);
  }

  async function saveMember() {
    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const trimmedName = editName.trim();
      const trimmedEmail = editEmail.trim();
      const trimmedPhone = editPhone.trim();

      if (!trimmedName) {
        throw new Error("Full name is required.");
      }

      if (trimmedEmail && !trimmedEmail.includes("@")) {
        throw new Error("Please enter a valid email address.");
      }

      const { data, error: updateError } = await supabase
        .from("members")
        .update({
          full_name: trimmedName,
          email: trimmedEmail || null,
          phone: trimmedPhone || null,
          role: editRole,
          status: editStatus,
        })
        .eq("id", memberId)
        .select(
          "id, member_number, full_name, email, phone, role, status, join_date"
        )
        .single();

      if (updateError) {
        throw updateError;
      }

      setMember(data);

      setEditName(data.full_name);
      setEditEmail(data.email ?? "");
      setEditPhone(data.phone ?? "");
      setEditRole(data.role);
      setEditStatus(data.status);

      setEditing(false);
      setSuccessMessage("Member information updated successfully.");

      setTimeout(() => {
        setSuccessMessage("");
      }, 4000);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update member."
      );
    } finally {
      setSaving(false);
    }
  }

  function formatMoney(amount: number) {
    return `KSh ${Number(amount).toLocaleString("en-KE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDate(date: string | null) {
    if (!date) return "—";

    return new Date(date).toLocaleDateString("en-KE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatRole(role: string) {
    return role
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatStatus(status: string) {
    return status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  const savings = contributions.reduce(
    (total, contribution) => total + Number(contribution.amount),
    0
  );

  const outstandingLoan = loans
    .filter(
      (loan) => !["fully_paid", "rejected"].includes(loan.status)
    )
    .reduce((total, loan) => total + Number(loan.balance), 0);

  const maximumLoan = savings * 0.7;

  const availableLoan = Math.max(
    0,
    maximumLoan - outstandingLoan
  );

  const totalLoanAmount = loans.reduce(
    (total, loan) => total + Number(loan.total_amount),
    0
  );

  const totalLoanPaid = loans.reduce(
    (total, loan) => total + Number(loan.amount_paid),
    0
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-gray-600">
            Loading member profile...
          </p>
        </div>
      </main>
    );
  }

  if (error || !member) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <h1 className="font-semibold text-red-800">
              Unable to load member
            </h1>

            <p className="mt-2 text-sm text-red-700">
              {error || "Member not found."}
            </p>

            <Link
              href="/members"
              className="mt-4 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            >
              Back to Members
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2">
              <Link
                href="/members"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                ← Back to Members
              </Link>
            </div>

            <h1 className="text-3xl font-bold text-gray-900">
              {member.full_name}
            </h1>

            <p className="mt-1 text-gray-600">
              {member.member_number ?? "No PSI number"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={startEditing}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Edit Member
            </button>

            <Link
              href="/"
              className="rounded-lg bg-gray-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-gray-800"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* Success message */}
        {successMessage && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        {/* Error message */}
        {error && !loading && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Edit Member Form */}
        {editing && (
          <section className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-blue-900">
                Edit Member
              </h2>

              <p className="mt-1 text-sm text-blue-700">
                Update this member's information below.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">

              {/* Full Name */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Full Name
                </label>

                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email
                </label>

                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-500"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Phone
                </label>

                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-500"
                />
              </div>

              {/* Role */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Role
                </label>

                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-500"
                >
                  <option value="chairperson">
                    Chairperson
                  </option>

                  <option value="treasurer">
                    Treasurer
                  </option>

                  <option value="secretary">
                    Secretary
                  </option>

                  <option value="member">
                    Member
                  </option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Status
                </label>

                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-500"
                >
                  <option value="active">
                    Active
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>

                  <option value="suspended">
                    Suspended
                  </option>
                </select>
              </div>

            </div>

            {/* Buttons */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={saveMember}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <button
                onClick={cancelEditing}
                disabled={saving}
                className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        {/* Member Information */}
        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Member Information
            </h2>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                member.status === "active"
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {formatStatus(member.status)}
            </span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-gray-500">
                Full Name
              </p>

              <p className="mt-1 font-medium text-gray-900">
                {member.full_name}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                PSI Number
              </p>

              <p className="mt-1 font-medium text-gray-900">
                {member.member_number ?? "—"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Role
              </p>

              <p className="mt-1 font-medium text-gray-900">
                {formatRole(member.role)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Join Date
              </p>

              <p className="mt-1 font-medium text-gray-900">
                {formatDate(member.join_date)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Email
              </p>

              <p className="mt-1 font-medium text-gray-900">
                {member.email || "—"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Phone
              </p>

              <p className="mt-1 font-medium text-gray-900">
                {member.phone || "—"}
              </p>
            </div>
          </div>
        </section>

        {/* Financial Summary */}
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Financial Position
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Total Savings
              </p>

              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatMoney(savings)}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Outstanding Loan
              </p>

              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatMoney(outstandingLoan)}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Maximum Loan
              </p>

              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatMoney(maximumLoan)}
              </p>

              <p className="mt-1 text-xs text-gray-500">
                70% of savings
              </p>
            </div>

            <div className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm">
              <p className="text-sm text-green-700">
                Available Loan
              </p>

              <p className="mt-2 text-2xl font-bold text-green-800">
                {formatMoney(availableLoan)}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Total Loan Paid
              </p>

              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatMoney(totalLoanPaid)}
              </p>
            </div>

          </div>
        </section>

        {/* Contributions */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Contribution History
              </h2>

              <p className="text-sm text-gray-500">
                {contributions.length} contribution
                {contributions.length === 1 ? "" : "s"} recorded
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-500">
                Total
              </p>

              <p className="font-bold text-gray-900">
                {formatMoney(savings)}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Date
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Amount
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Payment Method
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      M-Pesa Reference
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Notes
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {contributions.map((contribution) => (
                    <tr key={contribution.id}>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {formatDate(
                          contribution.contribution_date
                        )}
                      </td>

                      <td className="px-5 py-4 font-semibold text-gray-900">
                        {formatMoney(contribution.amount)}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {contribution.payment_method || "—"}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {contribution.mpesa_reference || "—"}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-500">
                        {contribution.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {contributions.length === 0 && (
              <div className="p-8 text-center text-sm text-gray-500">
                No contributions recorded for this member.
              </div>
            )}
          </div>
        </section>

        {/* Loans */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Loan History
              </h2>

              <p className="text-sm text-gray-500">
                {loans.length} loan
                {loans.length === 1 ? "" : "s"} recorded
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-500">
                Total Loan Value
              </p>

              <p className="font-bold text-gray-900">
                {formatMoney(totalLoanAmount)}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Date
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Principal
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Interest
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Total
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Paid
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Balance
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Due Date
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {loans.map((loan) => (
                    <tr key={loan.id}>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {formatDate(loan.application_date)}
                      </td>

                      <td className="px-5 py-4 font-medium text-gray-900">
                        {formatMoney(loan.principal_amount)}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {formatMoney(loan.interest_amount)}
                      </td>

                      <td className="px-5 py-4 font-medium text-gray-900">
                        {formatMoney(loan.total_amount)}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {formatMoney(loan.amount_paid)}
                      </td>

                      <td className="px-5 py-4 font-semibold text-gray-900">
                        {formatMoney(loan.balance)}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {formatDate(loan.due_date)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            loan.status === "approved" ||
                            loan.status === "disbursed"
                              ? "bg-green-100 text-green-700"
                              : loan.status === "rejected"
                              ? "bg-red-100 text-red-700"
                              : loan.status === "fully_paid"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {formatStatus(loan.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {loans.length === 0 && (
              <div className="p-8 text-center text-sm text-gray-500">
                No loans recorded for this member.
              </div>
            )}
          </div>
        </section>

        {/* PSI Rule */}
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-semibold text-blue-900">
            PSI Lending Rule
          </h2>

          <p className="mt-1 text-sm text-blue-800">
            A member can borrow up to 70% of their savings,
            less any outstanding loan balance.
          </p>
        </section>

      </div>
    </main>
  );
}
