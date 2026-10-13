import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

type Contribution = {
  amount: number;
  created_at: string | null;
};

type Repayment = {
  amount: number;
  created_at: string | null;
};

type Loan = {
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  amount_paid: number;
  balance: number;
  status: string;
  created_at: string | null;
};

type Member = {
  id: string;
  full_name: string;
  status: string;
};

export default async function ReportsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get current member
  const { data: currentMember } = await supabase
    .from("members")
    .select("id, full_name, role, member_number")
    .eq("user_id", user.id)
    .single();

  if (!currentMember) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <h1 className="text-2xl font-bold">
          PSI Reports
        </h1>

        <p className="mt-3 text-gray-600">
          Your account is not linked to a PSI member record.
        </p>
      </main>
    );
  }

  // Contributions
  const { data: contributionData, error: contributionError } =
    await supabase
      .from("contributions")
      .select("amount, created_at");

  if (contributionError) {
    return (
      <ErrorBox
        title="Unable to load contributions"
        message={contributionError.message}
      />
    );
  }

  // Repayments
  const { data: repaymentData, error: repaymentError } =
    await supabase
      .from("repayments")
      .select("amount, created_at");

  if (repaymentError) {
    return (
      <ErrorBox
        title="Unable to load repayments"
        message={repaymentError.message}
      />
    );
  }

  // Loans
  const { data: loanData, error: loanError } =
    await supabase
      .from("loans")
      .select(
        "principal_amount, interest_amount, total_amount, amount_paid, balance, status, created_at"
      );

  if (loanError) {
    return (
      <ErrorBox
        title="Unable to load loans"
        message={loanError.message}
      />
    );
  }

  // Members
  const { data: memberData, error: memberError } =
    await supabase
      .from("members")
      .select("id, full_name, status");

  if (memberError) {
    return (
      <ErrorBox
        title="Unable to load members"
        message={memberError.message}
      />
    );
  }

  const contributions =
    (contributionData ?? []) as Contribution[];

  const repayments =
    (repaymentData ?? []) as Repayment[];

  const loans =
    (loanData ?? []) as Loan[];

  const members =
    (memberData ?? []) as Member[];

  // -------------------------
  // Calculations
  // -------------------------

  const totalSavings = contributions.reduce(
    (total, contribution) =>
      total + Number(contribution.amount),
    0
  );

  const totalRepayments = repayments.reduce(
    (total, repayment) =>
      total + Number(repayment.amount),
    0
  );

  const totalPrincipal = loans.reduce(
    (total, loan) =>
      total + Number(loan.principal_amount),
    0
  );

  const totalInterest = loans.reduce(
    (total, loan) =>
      total + Number(loan.interest_amount),
    0
  );

  const totalLoanValue = loans.reduce(
    (total, loan) =>
      total + Number(loan.total_amount),
    0
  );

  const totalPaid = loans.reduce(
    (total, loan) =>
      total + Number(loan.amount_paid),
    0
  );

  const outstandingLoans = loans
    .filter(
      (loan) =>
        !["fully_paid", "rejected"].includes(
          loan.status
        )
    )
    .reduce(
      (total, loan) =>
        total + Number(loan.balance),
      0
    );

  const activeLoans = loans.filter(
    (loan) =>
      !["fully_paid", "rejected"].includes(
        loan.status
      )
  ).length;

  const activeMembers = members.filter(
    (member) => member.status === "active"
  ).length;

  const lendingCapacity = totalSavings * 0.7;

  function formatMoney(amount: number) {
    return `KSh ${Number(amount).toLocaleString(
      "en-KE",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }
    )}`;
  }

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
              PSI Reports
            </h1>

            <p className="mt-1 text-gray-600">
              Savings group financial overview
            </p>
          </div>

          <div className="text-left md:text-right">
            <p className="text-sm text-gray-500">
              Logged in as
            </p>

            <p className="font-semibold text-gray-900">
              {currentMember.full_name}
            </p>

            <p className="text-sm text-gray-500">
              {currentMember.role}
            </p>
          </div>
        </header>

        {/* Main statistics */}
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Group Overview
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            <ReportCard
              title="Total Savings"
              value={formatMoney(totalSavings)}
            />

            <ReportCard
              title="Outstanding Loans"
              value={formatMoney(outstandingLoans)}
            />

            <ReportCard
              title="Total Repayments"
              value={formatMoney(totalRepayments)}
            />

            <ReportCard
              title="Active Members"
              value={activeMembers.toString()}
            />

          </div>
        </section>

        {/* Loan statistics */}
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Loan Report
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

            <ReportCard
              title="Total Loans"
              value={loans.length.toString()}
            />

            <ReportCard
              title="Active Loans"
              value={activeLoans.toString()}
            />

            <ReportCard
              title="Principal Issued"
              value={formatMoney(totalPrincipal)}
            />

            <ReportCard
              title="Interest"
              value={formatMoney(totalInterest)}
            />

            <ReportCard
              title="Total Loan Value"
              value={formatMoney(totalLoanValue)}
            />

          </div>
        </section>

        {/* Repayment report */}
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Repayment Report
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

            <ReportCard
              title="Total Loan Payments"
              value={formatMoney(totalPaid)}
            />

            <ReportCard
              title="Recorded Repayments"
              value={repayments.length.toString()}
            />

            <ReportCard
              title="Outstanding Balance"
              value={formatMoney(outstandingLoans)}
            />

          </div>
        </section>

        {/* Lending capacity */}
        <section className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-6">

          <h2 className="text-lg font-semibold text-blue-900">
            PSI Lending Capacity
          </h2>

          <div className="mt-4 grid gap-5 sm:grid-cols-3">

            <div>
              <p className="text-sm text-blue-700">
                Total Savings
              </p>

              <p className="mt-1 text-2xl font-bold text-blue-900">
                {formatMoney(totalSavings)}
              </p>
            </div>

            <div>
              <p className="text-sm text-blue-700">
                70% Lending Capacity
              </p>

              <p className="mt-1 text-2xl font-bold text-blue-900">
                {formatMoney(lendingCapacity)}
              </p>
            </div>

            <div>
              <p className="text-sm text-blue-700">
                Current Outstanding
              </p>

              <p className="mt-1 text-2xl font-bold text-blue-900">
                {formatMoney(outstandingLoans)}
              </p>
            </div>

          </div>
        </section>

        {/* Navigation */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

          <h2 className="text-lg font-semibold text-gray-900">
            PSI Records
          </h2>

          <div className="mt-4 flex flex-wrap gap-3">

            <Link
              href="/members"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Members
            </Link>

            <Link
              href="/contributions"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Contributions
            </Link>

            <Link
              href="/loans"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Loans
            </Link>

            <Link
              href="/repayments"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Repayments
            </Link>

            <Link
              href="/transactions"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Transactions
            </Link>

          </div>

        </section>

        {/* Rules */}
        <section className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-5">

          <h2 className="font-semibold text-blue-900">
            PSI Lending Rules
          </h2>

          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-800">
            <li>
              Members can borrow up to 70% of their savings.
            </li>

            <li>
              Loan repayment period is 21 days.
            </li>

            <li>
              Standard interest rate is 10%.
            </li>

            <li>
              Repayments are applied to interest first.
            </li>

            <li>
              After 21 days, the interest doubles.
            </li>

            <li>
              Financial transactions must be recorded openly.
            </li>
          </ul>

        </section>

      </div>
    </main>
  );
}

function ReportCard({
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
      <div className="mx-auto max-w-7xl">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h1 className="font-semibold text-red-800">
            {title}
          </h1>

          <p className="mt-2 text-sm text-red-700">
            {message}
          </p>

          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}