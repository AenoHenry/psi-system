import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

type Transaction = {
  id: string;
  member_id: string | null;
  transaction_type: string | null;
  amount: number | string;
  transaction_date: string | null;
};

type Member = {
  id: string;
  member_number: string | null;
  full_name: string;
};

export default async function TransactionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get the signed-in member.
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
  const { data: transactionData, error: transactionError } = await supabase
    .from("transactions")
    .select("id, member_id, transaction_type, amount, transaction_date")
    .order("transaction_date", {
      ascending: false,
    });

  if (transactionError) {
    return (
      <ErrorBox
        title="Unable to Load Transactions"
        message={transactionError.message}
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

  const transactions = (transactionData ?? []) as Transaction[];

  const members = (memberData ?? []) as Member[];

  const memberLookup = new Map(
    members.map((member) => [member.id, member] as const),
  );

  const transactionRows = transactions.map((transaction) => {
    const member = transaction.member_id
      ? memberLookup.get(transaction.member_id)
      : undefined;

    return {
      ...transaction,
      member_number: member?.member_number ?? "—",
      member_name:
        member?.full_name ??
        (transaction.member_id ? "Member unavailable" : "Group / System"),
    };
  });

  // These summaries cover the records loaded on this page.
  // Total Recorded includes both inflows and outflows;
  // it is not the group's available balance.
  const totalTransactions = transactions.length;

  const totalAmount = transactions.reduce(
    (total, transaction) => total + Number(transaction.amount),
    0,
  );

  const moneyIn = transactions
    .filter((transaction) => isMoneyIn(transaction.transaction_type))
    .reduce((total, transaction) => total + Number(transaction.amount), 0);

  const moneyOut = transactions
    .filter((transaction) => isMoneyOut(transaction.transaction_type))
    .reduce((total, transaction) => total + Number(transaction.amount), 0);

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
              PSI Transactions
            </h1>

            <p className="mt-1 text-gray-600">
              Financial records available to your account
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
                + Record Transaction
              </Link>
            )}
          </div>
        </header>

        {/* Summary */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Transactions"
            value={totalTransactions.toString()}
          />

          <SummaryCard
            title="Total Recorded"
            value={formatMoney(totalAmount)}
          />

          <SummaryCard title="Money In" value={formatMoney(moneyIn)} />

          <SummaryCard title="Money Out" value={formatMoney(moneyOut)} />
        </section>

        {/* Transaction history */}
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Transaction History
            </h2>

            <p className="text-sm text-gray-500">
              Records are sorted by transaction date. Dates are shown in Kenya
              time.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Transaction Date
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Member
                    </th>

                    <th className="px-5 py-4 text-sm font-semibold text-gray-700">
                      Type
                    </th>

                    <th className="px-5 py-4 text-right text-sm font-semibold text-gray-700">
                      Amount
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {transactionRows.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {formatDate(transaction.transaction_date)}
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">
                          {transaction.member_name}
                        </p>

                        <p className="text-sm text-gray-500">
                          {transaction.member_number}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={
                            "rounded-full px-3 py-1 text-sm font-medium " +
                            transactionClass(transaction.transaction_type)
                          }
                        >
                          {formatTransactionType(transaction.transaction_type)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right font-semibold text-gray-900">
                        {formatMoney(transaction.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {transactionRows.length === 0 && (
              <div className="p-10 text-center text-sm text-gray-500">
                No transactions are available to your account.
              </div>
            )}
          </div>
        </section>

        {/* Explanation */}
        <section className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-semibold text-blue-900">PSI Financial Records</h2>

          <p className="mt-2 text-sm text-blue-800">
            Contributions and loan repayments are money in. Loan disbursements
            and group expenses are money out. Separate interest and penalty
            entries are also classified as money in.
          </p>

          <p className="mt-2 text-sm text-blue-800">
            Summary figures cover the records loaded above. Total Recorded adds
            inflows and outflows together; it is not the group&apos;s available
            balance.
          </p>

          <p className="mt-2 text-sm text-blue-800">
            Only active Chairpersons and Treasurers can record transactions.
            Access is also checked by the recording API and database function.
          </p>
        </section>
      </div>
    </main>
  );
}

function isMoneyIn(type: string | null) {
  return ["contribution", "loan_repayment", "interest", "penalty"].includes(
    type ?? "",
  );
}

function isMoneyOut(type: string | null) {
  return ["loan_disbursement", "expense"].includes(type ?? "");
}

function transactionClass(type: string | null) {
  if (isMoneyIn(type)) {
    return "bg-green-100 text-green-700";
  }

  if (isMoneyOut(type)) {
    return "bg-red-100 text-red-700";
  }

  return "bg-gray-100 text-gray-700";
}

function formatMoney(amount: number | string) {
  return `KSh ${Number(amount).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: string | null) {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }

  return parsedDate.toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTransactionType(type: string | null) {
  if (!type) return "Transaction";

  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
      <div className="mx-auto max-w-7xl">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h1 className="font-semibold text-red-800">{title}</h1>

          <p className="mt-2 text-sm text-red-700">{message}</p>

          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
