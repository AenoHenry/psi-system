"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  member_id: string;
  amount: number;
};

type Loan = {
  member_id: string;
  balance: number;
  status: string;
};

type MemberSummary = Member & {
  savings: number;
  outstandingLoan: number;
  maximumLoan: number;
  availableLoan: number;
};

export default function MembersPage() {
  const supabase = createClient();

  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  // Add member state
  const [showAddForm, setShowAddForm] = useState(false);
  const [savingMember, setSavingMember] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    try {
      setLoading(true);
      setError("");

      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select(
          "id, member_number, full_name, email, phone, role, status, join_date",
        )
        .order("member_number", { ascending: true });

      if (memberError) {
        throw memberError;
      }

      const { data: contributionData, error: contributionError } =
        await supabase.from("contributions").select("member_id, amount");

      if (contributionError) {
        throw contributionError;
      }

      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .select("member_id, balance, status");

      if (loanError) {
        throw loanError;
      }

      const summaries: MemberSummary[] = (memberData ?? []).map((member) => {
        const savings = (contributionData ?? [])
          .filter(
            (contribution: Contribution) =>
              contribution.member_id === member.id,
          )
          .reduce(
            (total, contribution) => total + Number(contribution.amount),
            0,
          );

        const outstandingLoan = (loanData ?? [])
          .filter(
            (loan: Loan) =>
              loan.member_id === member.id &&
              !["fully_paid", "rejected"].includes(loan.status),
          )
          .reduce((total, loan) => total + Number(loan.balance), 0);

        const maximumLoan = savings * 0.7;

        const availableLoan = Math.max(0, maximumLoan - outstandingLoan);

        return {
          ...member,
          savings,
          outstandingLoan,
          maximumLoan,
          availableLoan,
        };
      });

      setMembers(summaries);
    } catch (err) {
      console.error(err);

      setError(err instanceof Error ? err.message : "Failed to load members.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    try {
      setSavingMember(true);
      setError("");

      /*
       * Generate a simple PSI member number.
       *
       * Example:
       * PSI-001
       * PSI-002
       * PSI-003
       */

      const nextNumber = members.length + 1;

      const memberNumber = `PSI-${String(nextNumber).padStart(3, "0")}`;

      const { error: insertError } = await supabase.from("members").insert({
        member_number: memberNumber,
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        role,
        status: "active",
        join_date: new Date().toISOString().split("T")[0],
      });

      if (insertError) {
        throw insertError;
      }

      // Clear form
      setFullName("");
      setPhone("");
      setEmail("");
      setRole("member");

      setShowAddForm(false);

      // Reload members
      await loadMembers();
    } catch (err) {
      console.error(err);

      setError(err instanceof Error ? err.message : "Failed to add member.");
    } finally {
      setSavingMember(false);
    }
  }

  const filteredMembers = members.filter((member) => {
    const searchText = search.toLowerCase();

    return (
      member.full_name.toLowerCase().includes(searchText) ||
      (member.member_number ?? "").toLowerCase().includes(searchText) ||
      member.role.toLowerCase().includes(searchText)
    );
  });

  function formatMoney(amount: number) {
    return `KSh ${amount.toLocaleString("en-KE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatRole(role: string) {
    return role
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-gray-600">Loading PSI members...</p>
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
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/dashboard"
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ← Dashboard
              </Link>

              <Link
                href="/members/add"
                className="rounded-lg bg-blue-700 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-800"
              >
                + Add Member
              </Link>
            </div>

            <h1 className="mt-3 text-3xl font-bold text-gray-900">
              PSI Members
            </h1>

            <p className="mt-1 text-gray-600">
              Members, savings and lending position
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Dashboard
            </Link>

            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              {showAddForm ? "Cancel" : "+ Add Member"}
            </button>
          </div>
        </div>

        {/* Add Member Form */}
        {showAddForm && (
          <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-gray-900">
                Add New PSI Member
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Enter the member's basic information.
              </p>
            </div>

            <form
              onSubmit={handleAddMember}
              className="grid gap-5 md:grid-cols-2"
            >
              {/* Full name */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Full Name *
                </label>

                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter full name"
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-700"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Phone Number *
                </label>

                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0712345678"
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-700"
                />
              </div>

              {/* Email */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="member@example.com"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-700"
                />
              </div>

              {/* Role */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Role
                </label>

                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-700"
                >
                  <option value="member">Member</option>

                  <option value="secretary">Secretary</option>

                  <option value="treasurer">Treasurer</option>

                  <option value="chairperson">Chairperson</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 md:col-span-2">
                <button
                  type="submit"
                  disabled={savingMember}
                  className="rounded-lg bg-blue-700 px-6 py-3 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingMember ? "Adding Member..." : "Add Member"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by name, PSI number or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-700"
          />
        </div>

        <div className="mb-4 text-sm text-gray-600">
          Showing {filteredMembers.length} of {members.length} members
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                    Member
                  </th>

                  <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                    Role
                  </th>

                  <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                    Status
                  </th>

                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700">
                    Savings
                  </th>

                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700">
                    Outstanding
                  </th>

                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700">
                    Max Loan
                  </th>

                  <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700">
                    Available
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900">
                        {member.full_name}
                      </div>

                      <div className="text-sm text-gray-500">
                        {member.member_number ?? "No PSI number"}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm text-gray-700">
                      {formatRole(member.role)}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-medium ${
                          member.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {formatRole(member.status)}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right font-medium text-gray-900">
                      {formatMoney(member.savings)}
                    </td>

                    <td className="px-5 py-4 text-right font-medium text-gray-900">
                      {formatMoney(member.outstandingLoan)}
                    </td>

                    <td className="px-5 py-4 text-right text-gray-700">
                      {formatMoney(member.maximumLoan)}
                    </td>

                    <td className="px-5 py-4 text-right font-semibold text-green-700">
                      {formatMoney(member.availableLoan)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="space-y-4 md:hidden">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="font-bold text-gray-900">
                    {member.full_name}
                  </h2>

                  <p className="text-sm text-gray-500">
                    {member.member_number}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    member.status === "active"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {formatRole(member.status)}
                </span>
              </div>

              <p className="mb-4 text-sm text-gray-600">
                {formatRole(member.role)}
              </p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Savings</p>

                  <p className="font-semibold">{formatMoney(member.savings)}</p>
                </div>

                <div>
                  <p className="text-gray-500">Outstanding</p>

                  <p className="font-semibold">
                    {formatMoney(member.outstandingLoan)}
                  </p>
                </div>

                <div>
                  <p className="text-gray-500">Max Loan</p>

                  <p className="font-semibold">
                    {formatMoney(member.maximumLoan)}
                  </p>
                </div>

                <div>
                  <p className="text-gray-500">Available</p>

                  <p className="font-semibold text-green-700">
                    {formatMoney(member.availableLoan)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredMembers.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
            <h2 className="font-semibold text-gray-900">No members found</h2>

            <p className="mt-1 text-sm text-gray-500">
              Try a different search.
            </p>
          </div>
        )}

        {/* PSI rule */}
        <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-semibold text-blue-900">PSI Lending Rule</h2>

          <p className="mt-1 text-sm text-blue-800">
            A member can borrow up to 70% of their savings, less any outstanding
            loan balance.
          </p>
        </div>
      </div>
    </main>
  );
}
