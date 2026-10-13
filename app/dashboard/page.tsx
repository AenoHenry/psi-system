import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { CSSProperties } from "react";

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

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "20px",
  marginTop: "20px",
};
const panelStyle: CSSProperties = {
  background: "white",
  padding: "25px",
  borderRadius: "12px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};
const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "24px",
  background: "#f5f7fa",
  fontFamily: "Arial, sans-serif",
  color: "#222",
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
      <main style={pageStyle}>
        <div style={{ ...panelStyle, maxWidth: "700px", margin: "0 auto" }}>
          <h1>PSI Dashboard</h1>
          <p style={{ color: "#666" }}>
            Your login is not linked to a PSI member record.
          </p>
          <NavLink href="/login" label="Back to Login" />
        </div>
      </main>
    );

  if (member.status !== "active")
    return (
      <main style={pageStyle}>
        <div style={{ ...panelStyle, maxWidth: "700px", margin: "0 auto" }}>
          <h1>PSI Dashboard</h1>
          <p>
            Welcome, <strong>{member.full_name}</strong>.
          </p>
          <p style={{ color: "#666" }}>
            Your membership is {member.status}. Group Overview and Group Chat
            require active membership. Contact the Chairperson for assistance.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
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
    <main style={pageStyle}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
            marginBottom: "25px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ marginBottom: "5px" }}>PSI Savings Group</h1>
            <p style={{ margin: 0 }}>
              Welcome, <strong>{member.full_name}</strong>
            </p>
          </div>
          <div
            style={{
              textAlign: "right",
              background: "white",
              padding: "12px 18px",
              borderRadius: "10px",
              border: "1px solid #ddd",
            }}
          >
            <strong>{formatRole(role)}</strong>
            <br />
            <span style={{ color: "#666", fontSize: "14px" }}>
              {member.member_number || "No member number"}
            </span>
          </div>
        </header>

        <nav
          aria-label="Member navigation"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "30px",
            padding: "15px",
            background: "white",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          }}
        >
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
          <section
            style={{
              marginBottom: "30px",
              padding: "18px 20px",
              background: "#eef6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "12px",
            }}
          >
            <strong>Chairperson Access</strong>
            <p
              style={{
                marginTop: "6px",
                marginBottom: 0,
                color: "#475569",
                fontSize: "14px",
              }}
            >
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
              <p style={{ color: "#666", fontSize: "14px" }}>
                Group-wide totals shared with all active members. Individual
                financial records remain controlled by the existing database
                permissions.
              </p>
              <div style={gridStyle}>
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
              <p style={{ marginTop: "15px", color: "#666", fontSize: "13px" }}>
                Savings are member contributions, not available cash. Pending
                and approved loans are not counted as money already lent.
                Updated {timestamp(summary.generated_at)}.
              </p>
            </section>
            <section style={{ marginTop: "40px" }}>
              <h2>My Financial Position</h2>
              <p style={{ color: "#666", fontSize: "14px" }}>
                These figures belong to your account only.
              </p>
              <div style={gridStyle}>
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
          <section
            role="alert"
            style={{ ...panelStyle, border: "1px solid #fca5a5" }}
          >
            <h2>Financial Summary Unavailable</h2>
            <p style={{ color: "#666" }}>
              The summary could not be loaded. Check that dashboard-summary.sql
              completed successfully and inspect the server terminal. Missing
              figures are not shown as zero.
            </p>
            <p style={{ color: "#666" }}>
              You can still use the navigation and Group Chat.
            </p>
          </section>
        )}

        <section style={{ marginTop: "40px" }}>
          <h2>Quick Actions</h2>
          <div style={gridStyle}>
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

        <section style={{ ...panelStyle, marginTop: "40px" }}>
          <h2>PSI Loan Rules</h2>
          <ul style={{ lineHeight: 1.8 }}>
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
          <p style={{ color: "#666", fontSize: "14px" }}>
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
      style={{
        display: "inline-block",
        padding: "10px 15px",
        borderRadius: "8px",
        background: active ? "#222" : "#f1f3f5",
        color: active ? "white" : "#222",
        textDecoration: "none",
        fontSize: "14px",
        fontWeight: 600,
      }}
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
    <Link
      href={href}
      style={{
        display: "block",
        padding: "20px",
        background: "white",
        borderRadius: "12px",
        border: "1px solid #ddd",
        textDecoration: "none",
        color: "#222",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={{ marginBottom: 0, color: "#666", fontSize: "14px" }}>
        {description}
      </p>
    </Link>
  );
}
function DashboardCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={panelStyle}>
      <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>{title}</p>
      <h2 style={{ marginTop: "10px" }}>{value}</h2>
    </div>
  );
}
