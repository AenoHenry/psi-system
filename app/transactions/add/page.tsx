import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TransactionForm from "./transaction-form";

export default async function AddTransactionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: currentMember, error: currentMemberError } =
    await supabase
      .from("members")
      .select("id, full_name, role, status")
      .eq("user_id", user.id)
      .single();

  if (
    currentMemberError ||
    !currentMember ||
    currentMember.status !== "active" ||
    !["chairperson", "treasurer"].includes(currentMember.role)
  ) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-2xl rounded-xl border bg-white p-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Access Restricted
          </h1>

          <p className="mt-3 text-gray-600">
            Only an active Chairperson or Treasurer can
            record financial transactions.
          </p>

          <Link
            href="/transactions"
            className="mt-6 inline-block font-semibold underline"
          >
            Back to Transactions
          </Link>
        </div>
      </main>
    );
  }

  const [memberResult, loanResult] = await Promise.all([
    supabase
      .from("members")
      .select("id, member_number, full_name, status")
      .order("full_name"),

    supabase
      .from("loans")
      .select(
        "id, member_id, principal_amount, total_amount, balance, status"
      )
      .in("status", [
        "approved",
        "disbursed",
        "partially_paid",
        "overdue",
      ])
      .order("created_at", { ascending: false }),
  ]);

  if (memberResult.error || loanResult.error) {
    console.error("TRANSACTION FORM LOAD ERROR:", {
      members: memberResult.error,
      loans: loanResult.error,
    });

    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-2xl rounded-xl border bg-white p-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Unable to Load Recording Form
          </h1>

          <p className="mt-3 text-gray-600">
            The members or loans could not be loaded.
            Check the server terminal for details.
          </p>

          <Link
            href="/transactions"
            className="mt-6 inline-block font-semibold underline"
          >
            Back to Transactions
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/transactions"
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          ← Back to Transactions
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-gray-900">
          Record Transaction
        </h1>

        <p className="mt-2 text-gray-600">
          Recording as {currentMember.full_name}
          {" · "}
          {currentMember.role}
        </p>

        <div className="mt-8">
          <TransactionForm
            members={memberResult.data ?? []}
            loans={loanResult.data ?? []}
          />
        </div>
      </div>
    </main>
  );
}