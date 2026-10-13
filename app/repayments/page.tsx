import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

type Repayment = {
  id: string;
  loan_id: string;
  member_id: string;
  amount: number | string;
  payment_method: string | null;
  mpesa_reference: string | null;
  notes: string | null;
  payment_date: string | null;
};

type Loan = {
  id: string;
  member_id: string;
  balance: number | string;
  status: string;
};

type Member = {
  id: string;
  member_number: string | null;
  full_name: string;
};

const outstandingStatuses = [
  "disbursed",
  "partially_paid",
  "overdue",
];

export default async function RepaymentsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: currentMember,
    error: currentMemberError,
  } = await supabase
    .from("members")
    .select("id, member_number, full_name, role, status")
    .eq("user_id", user.id)
    .single();

  if (currentMemberError || !currentMember) {
    return (
      <ErrorBox
        title="Account Not Linked"
        message="Your account is not linked to a PSI member record."
      />
    );
  }

  const canRecord =
    currentMember.status === "active" &&
    ["chairperson", "treasurer"].includes(
      currentMember.role
    );

  // Read with the signed-in user's session.
  // Database policies determine which records are visible.
  const {
    data: repaymentData,
    error: repaymentError,
  } = await supabase
    .from("repayments")
    .select(
      "id, loan_id, member_id, amount, payment_method, mpesa_reference, notes, payment_date"
    )
    .order("payment_date", {
      ascending: false,
    });

  if (repaymentError) {
    return (
      <ErrorBox
        title="Unable to Load Repayments"
        message={repaymentError.message}
      />
    );
  }

  const {
    data: loanData,
    error: loanError,
  } = await supabase
    .from("loans")
    .select("id, member_id, balance, status");

  if (loanError) {
    return (
      <ErrorBox
        title="Unable to Load Loans"
        message={loanError.message}
      />
    );
  }

  const {
    data: memberData,
    error: memberError,
  } = await supabase
    .from("members")
    .select("id, member_number, full_name");

  if (memberError) {
    return (
      <ErrorBox
        title="Unable to Load Members"
        message={memberError.message}
      />
    );
  }

  const repayments =
    (repaymentData ?? []) as Repayment[];

  const loans =
    (loanData ?? []) as Loan[];

  const members =
    (memberData ?? []) as Member[];

  const loanLookup = new Map(
    loans.map((loan) => [loan.id, loan] as const)
  );

  const memberLookup = new Map(
    members.map((member) => [
      member.id,
      member,
    ] as const)
  );

  const repaymentRows = repayments.map((repayment) => {
    const loan = loanLookup.get(repayment.loan_id);
    const member = memberLookup.get(repayment.member_id);

    return {
      ...repayment,
      memberName:
        member?.full_name ?? "Member unavailable",
      memberNumber:
        member?.member_number ?? "—",
      currentLoanBalance:
        loan?.balance ?? null,
      currentLoanStatus:
        loan?.status ?? null,
    };
  });

  const totalRepayments = repayments.reduce(
    (total, repayment) =>
      total + Number(repayment.amount),
    0
  );

  // Only loans already disbursed contribute to debt.
  const totalOutstanding = loans
    .filter((loan) =>
      outstandingStatuses.includes(loan.status)
    )
    .reduce(
      (total, loan) => total + Number(loan.balance),
      0
    );

  const myTotalRepayments = repayments
    .filter(
      (repayment) =>
        repayment.member_id === currentMember.id
    )
    .reduce(
      (total, repayment) =>
        total + Number(repayment.amount),
      0
    );

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              ← Back to Dashboard
            </Link>

            <h1 className="mt-3 text-3xl font-bold text-gray-900">
              PSI Repayments
            </h1>

            <p className="mt-1 text-gray-600">
              Loan repayment records available to your account
            </p>
          </div>

          <div className="flex flex-col gap-4 md:items-end">
            <div className="text-left md:text-right">
              <p className="text-sm text-gray-500">
                Logged in as
              </p>

              <p className="font-semibold text-gray-900">
                {currentMember.full_name}
              </p>

              <p className="text-sm capitalize text-gray-500">
                {currentMember.role}
              </p>
            </div>

            {canRecord && (
              <Link
                href="/transactions/add"
                className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-5 py-3 font-semibold text-white hover:bg-gray-800"
              >
                + Record Repayment
              </Link>
            )}
          </div>
        </header>

        {/* Summary */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Repayment Records Loaded"
            value={repayments.length.toString()}
          />

          <SummaryCard
            title="Amount Repaid — Loaded Records"
            value={formatMoney(totalRepayments)}
          />

          <SummaryCard
            title="Outstanding — Loaded Loans"
            value={formatMoney(totalOutstanding)}
          />

          <SummaryCard
            title="My Repayments — Loaded Records"
            value={formatMoney(myTotalRepayments)}
          />
        </section>

        {/* History */}
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Repayment History
            </h2>

            <p className="text-sm text-gray-500">
              Payment dates are shown in Kenya time.
              Loan balances and statuses show their current
              values, not their values at the time of payment.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Member
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Loan
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Payment Date
                    </th>

                    <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700">
                      Amount
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Payment Method
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      M-Pesa Reference
                    </th>

                    <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700">
                      Current Loan Balance
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Current Loan Status
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Notes
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {repaymentRows.map((repayment) => (
                    <tr
                      key={repayment.id}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">
                          {repayment.memberName}
                        </p>

                        <p className="text-sm text-gray-500">
                          {repayment.memberNumber}
                        </p>
                      </td>

                      <td
                        className="px-5 py-4 text-sm text-gray-600"
                        title={repayment.loan_id}
                      >
                        {repayment.loan_id.slice(0, 8)}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {formatDate(repayment.payment_date)}
                      </td>

                      <td className="px-5 py-4 text-right font-semibold text-gray-900">
                        {formatMoney(repayment.amount)}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {formatPaymentMethod(
                          repayment.payment_method
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {repayment.mpesa_reference || "—"}
                      </td>

                      <td className="px-5 py-4 text-right font-medium text-gray-900">
                        {repayment.currentLoanBalance === null
                          ? "—"
                          : formatMoney(
                              repayment.currentLoanBalance
                            )}
                      </td>

                      <td className="px-5 py-4">
                        {repayment.currentLoanStatus ? (
                          <span
                            className={
                              "rounded-full px-3 py-1 text-xs font-medium " +
                              statusClass(
                                repayment.currentLoanStatus
                              )
                            }
                          >
                            {formatStatus(
                              repayment.currentLoanStatus
                            )}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">
                            Loan unavailable
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-500">
                        {repayment.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {repaymentRows.length === 0 && (
              <div className="p-10 text-center text-sm text-gray-500">
                No repayment records are available to
                your account.
              </div>
            )}
          </div>
        </section>

        {/* Recording information */}
        <section className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-semibold text-blue-900">
            PSI Repayment Recording
          </h2>

          <p className="mt-2 text-sm text-blue-800">
            To record a repayment, open Record Transaction
            and select Loan Repayment. Then select the
            member and the specific loan.
          </p>

          <p className="mt-2 text-sm text-blue-800">
            Only an active Chairperson or Treasurer can
            record a repayment. The shared function saves
            the repayment, updates the loan balance, and
            adds the transaction together.
          </p>

          <p className="mt-2 text-sm text-blue-800">
            A repayment cannot exceed the outstanding
            balance. Do not record the same payment again
            as a separate transaction.
          </p>

          <p className="mt-2 text-sm text-blue-800">
            The current workflow tracks total repaid and
            the combined principal-and-interest balance.
            Separate interest and principal allocations
            are not stored by this workflow.
          </p>

          <p className="mt-2 text-sm text-blue-800">
            New loans are due 21 days after disbursement.
            Summary figures cover the records loaded above.
          </p>
        </section>
      </div>
    </main>
  );
}

function formatMoney(amount: number | string) {
  return `KSh ${Number(amount).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPaymentMethod(method: string | null) {
  if (!method) return "—";
  if (method === "mpesa") return "M-Pesa";

  return method
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: string) {
  if (status === "fully_paid") {
    return "bg-blue-100 text-blue-700";
  }

  if (["approved", "disbursed"].includes(status)) {
    return "bg-green-100 text-green-700";
  }

  if (["rejected", "overdue"].includes(status)) {
    return "bg-red-100 text-red-700";
  }

  return "bg-yellow-100 text-yellow-700";
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}

function ErrorBox({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-2xl font-bold text-red-800">
          {title}
        </h1>

        <p className="mt-3 text-red-700">
          {message}
        </p>

        <Link
          href="/dashboard"
          className="mt-5 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}