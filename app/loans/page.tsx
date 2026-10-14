import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoanManagement from "./loan-management";

type Loan = {
  id: string;
  member_id: string;
  principal_amount: number | string;
  interest_rate: number | string;
  interest_amount: number | string;
  total_amount: number | string;
  amount_paid: number | string;
  balance: number | string;
  application_date: string | null;
  disbursed_at: string | null;
  due_date: string | null;
  status: string;
  purpose: string | null;
};
type Member = {
  id: string;
  member_number: string | null;
  full_name: string;
  status: string;
};
const fundedStatuses = ["disbursed", "partially_paid", "fully_paid", "overdue"];
const outstandingStatuses = ["disbursed", "partially_paid", "overdue"];

export default async function LoansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: currentMember, error: currentMemberError } = await supabase
    .from("members")
    .select("id, member_number, full_name, role, status")
    .eq("user_id", user.id)
    .single();
  if (currentMemberError || !currentMember)
    return (
      <ErrorBox
        title="Account Not Linked"
        message="Your login is not linked to a PSI member record."
      />
    );

  const canManage =
    currentMember.status === "active" &&
    ["chairperson", "treasurer"].includes(currentMember.role);
  const [loanResult, memberResult] = await Promise.all([
    supabase
      .from("loans")
      .select(
        "id, member_id, principal_amount, interest_rate, interest_amount, total_amount, amount_paid, balance, application_date, disbursed_at, due_date, status, purpose",
      )
      .order("application_date", { ascending: false }),
    supabase
      .from("members")
      .select("id, member_number, full_name, status")
      .order("full_name"),
  ]);
  if (loanResult.error || memberResult.error) {
    console.error("LOANS PAGE ERROR:", {
      loans: loanResult.error,
      members: memberResult.error,
    });
    return (
      <ErrorBox
        title="Unable to Load Loans"
        message="The loans or members could not be loaded. Check the server terminal for details."
      />
    );
  }
  const loans = (loanResult.data ?? []) as Loan[];
  const members = (memberResult.data ?? []) as Member[];
  const lookup = new Map(members.map((member) => [member.id, member] as const));
  const rows = loans.map((loan) => ({
    ...loan,
    member_name: lookup.get(loan.member_id)?.full_name ?? "Member unavailable",
    member_number: lookup.get(loan.member_id)?.member_number ?? "—",
  }));
  const fundedLoans = loans.filter((loan) =>
    fundedStatuses.includes(loan.status),
  );
  const outstandingLoans = loans.filter((loan) =>
    outstandingStatuses.includes(loan.status),
  );
  const principal = fundedLoans.reduce(
    (total, loan) => total + Number(loan.principal_amount),
    0,
  );
  const paid = fundedLoans.reduce(
    (total, loan) => total + Number(loan.amount_paid),
    0,
  );
  const outstanding = outstandingLoans.reduce(
    (total, loan) => total + Number(loan.balance),
    0,
  );
  const myLoans = loans.filter((loan) => loan.member_id === currentMember.id);
  const myOutstanding = outstandingLoans
    .filter((loan) => loan.member_id === currentMember.id)
    .reduce((total, loan) => total + Number(loan.balance), 0);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-gray-900">PSI Loans</h1>
            <p className="mt-1 text-gray-600">
              Loan records available to your account
            </p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-sm text-gray-500">Logged in as</p>
            <p className="font-semibold text-gray-900">
              {currentMember.full_name}
            </p>
            <p className="text-sm capitalize text-gray-500">
              {currentMember.role}
            </p>
          </div>
        </header>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard title="Loan Records" value={String(loans.length)} />
          <SummaryCard
            title="Outstanding Loans"
            value={String(
              outstandingLoans.filter((loan) => Number(loan.balance) > 0)
                .length,
            )}
          />
          <SummaryCard title="Disbursed Principal" value={money(principal)} />
          <SummaryCard title="Repaid on Funded Loans" value={money(paid)} />
          <SummaryCard title="Outstanding" value={money(outstanding)} />
        </section>

        <section className="mb-8 rounded-xl border border-green-200 bg-green-50 p-6">
          <h2 className="text-lg font-semibold text-green-900">
            My Loan Position
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-green-700">My Loan Records</p>
              <p className="mt-1 text-2xl font-bold text-green-900">
                {myLoans.length}
              </p>
            </div>
            <div>
              <p className="text-sm text-green-700">My Outstanding Balance</p>
              <p className="mt-1 text-2xl font-bold text-green-900">
                {money(myOutstanding)}
              </p>
            </div>
          </div>
        </section>

        {canManage && (
          <LoanManagement
            members={members.filter((member) => member.status === "active")}
            pendingLoans={rows.filter((loan) => loan.status === "pending")}
          />
        )}

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Loan History
            </h2>
            <p className="text-sm text-gray-500">
              Dates are shown in Kenya time. Pending and approved loans are not
              counted as money already lent.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b bg-gray-50">
                  <tr>
                    {[
                      "Member",
                      "Application",
                      "Disbursed",
                      "Principal",
                      "Interest",
                      "Total",
                      "Paid",
                      "Outstanding",
                      "Due Date",
                      "Status",
                    ].map((heading, index) => (
                      <th
                        key={heading}
                        className={`px-5 py-4 text-sm font-semibold text-gray-700 ${index >= 3 && index <= 7 ? "text-right" : ""}`}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((loan) => (
                    <tr key={loan.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">
                          {loan.member_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {loan.member_number}
                        </p>
                        <p className="text-sm text-gray-400">
                          Loan {loan.id.slice(0, 8)}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {date(loan.application_date)}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {date(loan.disbursed_at)}
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-gray-900">
                        {money(loan.principal_amount)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-gray-700">
                        {money(loan.interest_amount)}
                        <p className="text-sm text-gray-500">
                          {Number(loan.interest_rate)}%
                        </p>
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-gray-900">
                        {money(loan.total_amount)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-gray-700">
                        {money(loan.amount_paid)}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-gray-900">
                        {fundedStatuses.includes(loan.status)
                          ? money(loan.balance)
                          : "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {date(loan.due_date)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-medium ${statusClass(loan.status)}`}
                        >
                          {loan.status.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && (
              <div className="p-10 text-center text-sm text-gray-500">
                No loan records are available to your account.
              </div>
            )}
          </div>
        </section>
        <section className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-semibold text-blue-900">PSI Lending Rules</h2>
          <p className="mt-2 text-sm text-blue-800">
            Borrowing limit: 70% of confirmed contributions, less outstanding
            balances on loans already disbursed. The limit cannot be negative.
          </p>
          <p className="mt-2 text-sm text-blue-800">
            Interest is a one-time 10% charge, rounded to cents. Repayment is
            due 21 days after disbursement.
          </p>
          <p className="mt-2 text-sm text-blue-800">
            Creation, approval, and disbursement recheck eligibility. Approval
            does not reserve funds or send money. Only an active Chairperson or
            Treasurer can manage this workflow.
          </p>
          <p className="mt-2 text-sm text-blue-800">
            Summary figures cover the records loaded on this page. Existing
            legacy records are displayed, not automatically corrected.
          </p>
        </section>
      </div>
    </main>
  );
}

function money(amount: number | string) {
  return `KSh ${Number(amount).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
}
function date(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function statusClass(status: string) {
  if (["approved", "disbursed"].includes(status))
    return "bg-green-100 text-green-700";
  if (["rejected", "overdue"].includes(status))
    return "bg-red-100 text-red-700";
  if (status === "fully_paid") return "bg-blue-100 text-blue-700";
  return "bg-yellow-100 text-yellow-700";
}
function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
function ErrorBox({ title, message }: { title: string; message: string }) {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-2xl font-bold text-red-800">{title}</h1>
        <p className="mt-3 text-red-700">{message}</p>
        <Link
          href="/dashboard"
          className="mt-5 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white"
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}
