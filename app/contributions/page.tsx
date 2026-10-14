import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

type Contribution = {
  id: string;
  member_id: string;
  amount: number | string;
  contribution_date: string;
  payment_method: string | null;
  mpesa_reference: string | null;
  notes: string | null;
  verification_status: string;
};

type Member = {
  id: string;
  member_number: string | null;
  full_name: string;
};

export default async function ContributionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: currentMember, error: currentMemberError } = await supabase
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
    ["chairperson", "treasurer"].includes(currentMember.role);

  // Read using the signed-in session.
  // Database policies determine which records are visible.
  const { data: contributionData, error: contributionError } = await supabase
    .from("contributions")
    .select(
      "id, member_id, amount, contribution_date, payment_method, mpesa_reference, notes, verification_status",
    )
    .order("contribution_date", {
      ascending: false,
    });

  if (contributionError) {
    return (
      <ErrorBox
        title="Unable to Load Contributions"
        message={contributionError.message}
      />
    );
  }

  const { data: memberData, error: memberError } = await supabase
    .from("members")
    .select("id, member_number, full_name");

  if (memberError) {
    return (
      <ErrorBox title="Unable to Load Members" message={memberError.message} />
    );
  }

  const contributions = (contributionData ?? []) as Contribution[];

  const members = (memberData ?? []) as Member[];

  const memberLookup = new Map(
    members.map((member) => [member.id, member] as const),
  );

  const contributionRows = contributions.map((contribution) => {
    const member = memberLookup.get(contribution.member_id);

    return {
      ...contribution,
      member_number: member?.member_number ?? "—",
      member_name: member?.full_name ?? "Member unavailable",
    };
  });

  // Only confirmed contributions count as savings.
  const confirmedContributions = contributions.filter(
    (contribution) => contribution.verification_status === "confirmed",
  );

  const confirmedSavings = confirmedContributions.reduce(
    (total, contribution) => total + Number(contribution.amount),
    0,
  );

  const myConfirmedSavings = confirmedContributions
    .filter((contribution) => contribution.member_id === currentMember.id)
    .reduce((total, contribution) => total + Number(contribution.amount), 0);

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
              PSI Contributions
            </h1>

            <p className="mt-1 text-gray-600">
              Savings records available to your account
            </p>
          </div>

          <div className="flex flex-col gap-4 md:items-end">
            <div className="text-left md:text-right">
              <p className="text-sm text-gray-500">Logged in as</p>

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
                className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800"
              >
                + Record Contribution
              </Link>
            )}
          </div>
        </header>

        {/* Summary */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            title="Confirmed Savings — Loaded Records"
            value={formatMoney(confirmedSavings)}
          />

          <SummaryCard
            title="My Confirmed Savings — Loaded Records"
            value={formatMoney(myConfirmedSavings)}
          />

          <SummaryCard
            title="Contribution Records Loaded"
            value={contributions.length.toString()}
          />
        </section>

        {/* History */}
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Contribution History
            </h2>

            <p className="text-sm text-gray-500">
              Dates are shown in Kenya time. Pending and rejected contributions
              do not count as savings.
            </p>
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
                      Member
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      PSI Number
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

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Status
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Notes
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {contributionRows.map((contribution) => (
                    <tr key={contribution.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {formatDate(contribution.contribution_date)}
                      </td>

                      <td className="px-5 py-4 font-semibold text-gray-900">
                        {contribution.member_name}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {contribution.member_number}
                      </td>

                      <td className="px-5 py-4 text-right font-semibold text-gray-900">
                        {formatMoney(contribution.amount)}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {formatPaymentMethod(contribution.payment_method)}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {contribution.mpesa_reference || "—"}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={
                            "rounded-full px-3 py-1 text-sm font-medium capitalize " +
                            statusClass(contribution.verification_status)
                          }
                        >
                          {contribution.verification_status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-500">
                        {contribution.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {contributionRows.length === 0 && (
              <div className="p-10 text-center text-sm text-gray-500">
                No contribution records are available to your account.
              </div>
            )}
          </div>
        </section>

        {/* Recording information */}
        <section className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-semibold text-blue-900">
            PSI Savings and Recording
          </h2>

          <p className="mt-2 text-sm text-blue-800">
            Confirmed contributions form the savings used to calculate borrowing
            capacity. Pending and rejected contributions are excluded.
          </p>

          <p className="mt-2 text-sm text-blue-800">
            To record a contribution, use Record Transaction and select Member
            Contribution. Only an active Chairperson or Treasurer can record it.
          </p>

          <p className="mt-2 text-sm text-blue-800">
            The shared recording function saves the contribution and its
            matching transaction together. Do not enter the same payment again
            as a separate transaction.
          </p>

          <p className="mt-2 text-sm text-blue-800">
            Summary figures cover the records loaded on this page. The database
            borrowing-limit calculation checks all applicable records.
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

function formatDate(value: string) {
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

function statusClass(status: string) {
  if (status === "confirmed") {
    return "bg-green-100 text-green-700";
  }

  if (status === "rejected") {
    return "bg-red-100 text-red-700";
  }

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
