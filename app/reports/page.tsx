import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Summary = {
  group: {
    confirmed_savings: string;
    outstanding_loans: string;
    active_members: number;
    outstanding_loan_count: number;
  };
  personal: {
    confirmed_savings: string;
    outstanding_loans: string;
    maximum_loan: string;
    available_loan: string;
  };
  report: {
    total_loan_records: number;
    pending_loans: number;
    approved_awaiting_disbursement: number;
    funded_loan_count: number;
    principal_issued: string;
    contracted_interest: string;
    total_repayable_on_funded_loans: string;
    paid_on_loan_records: string;
    repayment_record_count: number;
    recorded_repayments: string;
    repayment_reconciliation_required: boolean;
  };
  generated_at: string;
};

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: currentMember, error: memberError } = await supabase
    .from("members")
    .select("id, full_name, role, member_number, status")
    .eq("user_id", user.id)
    .single();

  if (memberError || !currentMember)
    return (
      <ErrorBox
        title="Account Not Linked"
        message="Your account is not linked to a PSI member record."
      />
    );

  if (currentMember.status !== "active")
    return (
      <ErrorBox
        title="Reports Access Restricted"
        message="Group reports are available to active PSI members. Contact the Chairperson about your membership status."
      />
    );

  const { data, error } = await supabase.rpc("psi_reports_summary");
  if (error || !data?.group || !data?.personal || !data?.report) {
    console.error(
      "REPORTS SUMMARY ERROR:",
      error ?? "Unexpected summary response",
    );
    return (
      <ErrorBox
        title="Unable to Load Reports"
        message="The financial summary could not be loaded. Check that reports-summary.sql completed successfully, then inspect the server terminal. Missing figures are not treated as zero."
      />
    );
  }

  const summary = data as Summary;
  const { group, personal, report } = summary;
  const isOfficer = ["chairperson", "treasurer", "secretary"].includes(
    currentMember.role,
  );
  const canRecord = ["chairperson", "treasurer"].includes(currentMember.role);

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
            <h1 className="mt-3 text-3xl font-bold text-gray-900">
              PSI Reports
            </h1>
            <p className="mt-1 text-gray-600">
              Group-wide aggregates and your personal financial position
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Summary generated {formatDate(summary.generated_at)} · Kenya time
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

        <section className="mb-8">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            Group Overview
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            These are actual group-wide totals, shared with all active members.
            Other members' individual financial records are not returned by the
            report function.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReportCard
              title="Confirmed Group Savings"
              value={money(group.confirmed_savings)}
            />
            <ReportCard
              title="Group Outstanding Loan Balance"
              value={money(group.outstanding_loans)}
            />
            <ReportCard
              title="Active Members"
              value={String(group.active_members)}
            />
            <ReportCard
              title="Outstanding Loans"
              value={String(group.outstanding_loan_count)}
            />
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Group Loan Report
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReportCard
              title="All Loan Records"
              value={String(report.total_loan_records)}
            />
            <ReportCard
              title="Pending Loans"
              value={String(report.pending_loans)}
            />
            <ReportCard
              title="Approved — Not Yet Disbursed"
              value={String(report.approved_awaiting_disbursement)}
            />
            <ReportCard
              title="Funded Loans — Including Fully Paid"
              value={String(report.funded_loan_count)}
            />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <ReportCard
              title="Principal Issued on Funded Loans"
              value={money(report.principal_issued)}
            />
            <ReportCard
              title="Contracted Interest on Funded Loans"
              value={money(report.contracted_interest)}
            />
            <ReportCard
              title="Total Repayable on Funded Loans"
              value={money(report.total_repayable_on_funded_loans)}
            />
          </div>
          <p className="mt-3 text-sm text-gray-500">
            Funded totals exclude pending, approved-but-undisbursed, and
            rejected loans. Contracted interest is not the same as interest
            collected. Existing historical values are reported as stored, not
            automatically corrected.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Group Repayment Report
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReportCard
              title="Recorded Repayment Amount"
              value={money(report.recorded_repayments)}
            />
            <ReportCard
              title="Repayment Records"
              value={String(report.repayment_record_count)}
            />
            <ReportCard
              title="Paid Amount Stored on Loan Records"
              value={money(report.paid_on_loan_records)}
            />
            <ReportCard
              title="Current Outstanding Loan Balance"
              value={money(group.outstanding_loans)}
            />
          </div>
          <p className="mt-3 text-sm text-gray-500">
            Recorded repayments and loan-level paid amounts are separate checks.
            Legacy records may need reconciliation; neither value is silently
            substituted for the other.
          </p>
          {report.repayment_reconciliation_required && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
            >
              Reconciliation needed: repayment records and loan-level paid
              amounts do not match. Check the original records before changing
              balances. This warning does not establish which figure is correct.
            </div>
          )}
        </section>

        <section className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-lg font-semibold text-blue-900">
            My Financial Position
          </h2>
          <p className="mt-2 text-sm text-blue-800">
            Only your own personal figures appear in this section.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReportCard
              title="My Confirmed Savings"
              value={money(personal.confirmed_savings)}
            />
            <ReportCard
              title="My Outstanding Balance"
              value={money(personal.outstanding_loans)}
            />
            <ReportCard
              title="70% of My Confirmed Savings"
              value={money(personal.maximum_loan)}
            />
            <ReportCard
              title="My Available Borrowing Limit"
              value={money(personal.available_loan)}
            />
          </div>
          <p className="mt-4 text-sm text-blue-800">
            Savings are not the group's available cash. Your borrowing limit is
            calculated individually, after outstanding debt; it is not a promise
            of cash availability or loan approval.
          </p>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">PSI Records</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {isOfficer && <RecordLink href="/members" label="Members" />}
            <RecordLink
              href="/contributions"
              label={isOfficer ? "Contributions" : "My Contributions"}
            />
            <RecordLink
              href="/loans"
              label={isOfficer ? "Loans" : "My Loans"}
            />
            <RecordLink
              href="/repayments"
              label={isOfficer ? "Repayments" : "My Repayments"}
            />
            <RecordLink
              href="/transactions"
              label={isOfficer ? "Transactions" : "My Transactions"}
            />
            <RecordLink href="/chat" label="Group Chat" />
            {canRecord && (
              <RecordLink href="/transactions/add" label="Record Transaction" />
            )}
          </div>
        </section>

        <section className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-semibold text-blue-900">
            Current Prototype Loan Rules
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-800">
            <li>
              Borrowing capacity is 70% of confirmed savings, less outstanding
              balances on disbursed loans.
            </li>
            <li>New loans use one-time 10% interest, rounded to cents.</li>
            <li>Repayment is due 21 days after disbursement.</li>
            <li>
              Only an active Chairperson or Treasurer can create, approve, and
              record financial transactions through this workflow.
            </li>
            <li>
              Approval does not send money; eligibility is checked again when
              disbursement is recorded.
            </li>
          </ul>
          <p className="mt-3 text-sm text-blue-800">
            Separate interest-first repayment allocations and automatic
            overdue-interest doubling are not implemented. This report does not
            apply penalties or modify historical financial records.
          </p>
        </section>
      </div>
    </main>
  );
}

function money(value: string | number) {
  return `KSh ${Number(value).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function formatDate(value: string) {
  return new Date(value).toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function ReportCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
function RecordLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
    >
      {label}
    </Link>
  );
}
function ErrorBox({ title, message }: { title: string; message: string }) {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-5">
        <h1 className="font-semibold text-red-800">{title}</h1>
        <p className="mt-2 text-sm text-red-700">{message}</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white"
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}
