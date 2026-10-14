import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import styles from "./dashboard.module.css";

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
  generated_at: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, member_number, full_name, role, status")
    .eq("user_id", user.id)
    .single();

  if (memberError || !member)
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1>PSI Dashboard</h1>
          <p>Your login is not linked to a PSI member record.</p>
          <NavLink href="/login" label="Back to Login" />
        </div>
      </main>
    );

  if (member.status !== "active")
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1>PSI Dashboard</h1>
          <p>
            Welcome, <strong>{member.full_name}</strong>.
          </p>
          <p>
            Your membership is {member.status}. Group Overview and Group Chat
            require active membership. Contact the Chairperson for assistance.
          </p>
          <div>
            <NavLink href="/contributions" label="My Contributions" />
            <NavLink href="/loans" label="My Loans" />
            <NavLink href="/repayments" label="My Repayments" />
          </div>
        </div>
      </main>
    );

  const role = String(member.role).toLowerCase();
  const isChairperson = role === "chairperson";
  const isFinancialOfficer = ["chairperson", "treasurer"].includes(role);
  const isOfficer = ["chairperson", "treasurer", "secretary"].includes(role);

  // The database returns genuine group totals and only this
  // member's personal totals, without exposing other members' rows.
  const { data, error: summaryError } = await supabase.rpc(
    "psi_dashboard_summary",
  );
  const summary =
    !summaryError && data?.group && data?.personal ? (data as Summary) : null;
  if (!summary)
    console.error(
      "DASHBOARD SUMMARY ERROR:",
      summaryError ?? "Unexpected response shape",
    );

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>PSI · SAVINGS GROUP</p>
            <h1>Your dashboard</h1>
            <p>
              Welcome, <strong>{member.full_name}</strong>
            </p>
          </div>
          <div>
            <strong className={styles.role}>{formatRole(role)}</strong>
            <br />
            <span>{member.member_number || "No member number"}</span>
          </div>
        </header>

        <nav aria-label="Member navigation">
          <NavLink href="/dashboard" label="Dashboard" active />
          {isOfficer && <NavLink href="/members" label="Members" />}
          <NavLink
            href="/contributions"
            label={isOfficer ? "Contributions" : "My Contributions"}
          />
          <NavLink href="/loans" label={isOfficer ? "Loans" : "My Loans"} />
          <NavLink
            href="/repayments"
            label={isOfficer ? "Repayments" : "My Repayments"}
          />
          {isFinancialOfficer && (
            <NavLink href="/transactions" label="Transactions" />
          )}
          {isOfficer && <NavLink href="/reports" label="Reports" />}
          <NavLink href="/chat" label="Group Chat" />
        </nav>

        {isChairperson && (
          <section className={styles.notice}>
            <strong>Chairperson Access</strong>
            <p>
              Manage member records and the permitted group financial workflow.
              Treasurer access covers financial recording; Group Chat is shared
              by all active members.
            </p>
          </section>
        )}

        {summary ? (
          <>
            <section>
              <h2>Group Overview</h2>
              <p>
                Group-wide totals shared with all active members. Individual
                financial records remain controlled by the existing database
                permissions.
              </p>
              <div className={styles.grid}>
                <DashboardCard
                  title="Total Confirmed Group Savings"
                  value={money(summary.group.confirmed_savings)}
                />
                <DashboardCard
                  title="Group Outstanding Loans"
                  value={money(summary.group.outstanding_loans)}
                />
                <DashboardCard
                  title="Active Members"
                  value={String(summary.group.active_members)}
                />
                <DashboardCard
                  title="Outstanding Loans"
                  value={String(summary.group.outstanding_loan_count)}
                />
              </div>
              <p>
                Savings are member contributions, not available cash. Pending
                and approved loans are not counted as money already lent.
                Updated {timestamp(summary.generated_at)}.
              </p>
            </section>
            <section>
              <h2>My Financial Position</h2>
              <p>These figures belong to your account only.</p>
              <div className={styles.grid}>
                <DashboardCard
                  title="My Confirmed Savings"
                  value={money(summary.personal.confirmed_savings)}
                />
                <DashboardCard
                  title="My Outstanding Loan Balance"
                  value={money(summary.personal.outstanding_loans)}
                />
                <DashboardCard
                  title="70% of My Savings"
                  value={money(summary.personal.maximum_loan)}
                />
                <DashboardCard
                  title="My Available Borrowing Limit"
                  value={money(summary.personal.available_loan)}
                />
              </div>
            </section>
          </>
        ) : (
          <section role="alert" className={styles.error}>
            <h2>Financial Summary Unavailable</h2>
            <p>
              The summary could not be loaded. Check that dashboard-summary.sql
              completed successfully and inspect the server terminal. Missing
              figures are not shown as zero.
            </p>
            <p>You can still use the navigation and Group Chat.</p>
          </section>
        )}

        <section>
          <h2>Quick Actions</h2>
          <div className={styles.grid}>
            <ActionCard
              href="/chat"
              title="Group Chat"
              description="Discuss group issues with other active PSI members."
            />
            {isOfficer && (
              <ActionCard
                href="/members"
                title="View Members"
                description="View the member records permitted for your role."
              />
            )}
            <ActionCard
              href="/contributions"
              title={isOfficer ? "Contributions" : "My Contributions"}
              description="View confirmed savings and contribution history."
            />
            <ActionCard
              href="/loans"
              title={isOfficer ? "Loans" : "My Loans"}
              description="View loan records and current balances."
            />
            <ActionCard
              href="/repayments"
              title={isOfficer ? "Repayments" : "My Repayments"}
              description="View loan repayment history."
            />
            {isFinancialOfficer && (
              <>
                <ActionCard
                  href="/transactions/add"
                  title="Record Transaction"
                  description="Record a contribution, disbursement, repayment, or expense."
                />
                <ActionCard
                  href="/transactions"
                  title="Transaction History"
                  description="View permitted financial transaction records."
                />
              </>
            )}
            {isOfficer && (
              <ActionCard
                href="/reports"
                title="Reports"
                description="Open the existing PSI reports section."
              />
            )}
          </div>
        </section>

        <section className={styles.rules}>
          <h2>PSI Loan Rules</h2>
          <ul>
            <li>
              Borrowing capacity is 70% of confirmed savings, less outstanding
              balances on disbursed loans.
            </li>
            <li>New loans use one-time 10% interest, rounded to cents.</li>
            <li>Repayment is due 21 days after disbursement.</li>
            <li>
              Only an active Chairperson or Treasurer can create, approve, and
              record loans through this workflow.
            </li>
            <li>
              Approval does not send money or reserve borrowing capacity;
              eligibility is checked again at disbursement.
            </li>
          </ul>
          <p>
            Separate interest-first repayment allocations and automatic
            overdue-interest doubling are not implemented in this prototype.
          </p>
        </section>
      </div>
    </main>
  );
}

function money(value: string | number) {
  return `KSh ${Number(value).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function timestamp(value: string) {
  return new Date(value).toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function formatRole(role: string) {
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function NavLink({
  href,
  label,
  active = false,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={active ? styles.navActive : styles.navLink}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}
function ActionCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className={styles.action}>
      <h3>
        {title}
        <span aria-hidden="true">↗</span>
      </h3>
      <p>{description}</p>
    </Link>
  );
}
function DashboardCard({ title, value }: { title: string; value: string }) {
  return (
    <div className={styles.card}>
      <p>{title}</p>
      <p className={styles.value}>{value}</p>
    </div>
  );
}
