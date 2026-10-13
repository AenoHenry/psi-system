"use client";

import {
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Member = {
  id: string;
  member_number: string | null;
  full_name: string;
  status: string;
};

type Loan = {
  id: string;
  member_id: string;
  principal_amount: number | string;
  total_amount: number | string;
  balance: number | string;
  status: string;
};

type Submission = {
  requestId: string;
  action: string;
  memberId: string | null;
  loanId: string | null;
  amount: string;
  paymentMethod: string;
  reference: string;
  notes: string;
};

function money(value: number | string) {
  return Number(value).toLocaleString("en-KE", {
    style: "currency",
    currency: "KES",
  });
}

export default function TransactionForm({
  members,
  loans,
}: {
  members: Member[];
  loans: Loan[];
}) {
  const router = useRouter();

  const [action, setAction] = useState("contribution");
  const [memberId, setMemberId] = useState("");
  const [loanId, setLoanId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Retain the exact request after an uncertain network result.
  const submissionRef = useRef<Submission | null>(null);
  const busyRef = useRef(false);

  const isExpense = action === "expense";
  const isDisbursement = action === "loan_disbursement";
  const isRepayment = action === "loan_repayment";
  const isLoan = isDisbursement || isRepayment;

  const eligibleMembers = members.filter(
    (member) =>
      isRepayment || member.status === "active"
  );

  const eligibleLoans = loans.filter((loan) => {
    if (loan.member_id !== memberId) return false;

    if (isDisbursement) {
      return loan.status === "approved";
    }

    return (
      ["disbursed", "partially_paid", "overdue"].includes(
        loan.status
      ) && Number(loan.balance) > 0
    );
  });

  const selectedLoan = eligibleLoans.find(
    (loan) => loan.id === loanId
  );

  function changeAction(value: string) {
    setAction(value);
    setMemberId("");
    setLoanId("");
    setAmount("");
    setError("");
    setSuccess("");
  }

  function changeMember(value: string) {
    setMemberId(value);
    setLoanId("");
    setAmount("");
  }

  function changeLoan(value: string) {
    setLoanId(value);

    const loan = eligibleLoans.find(
      (item) => item.id === value
    );

    setAmount(
      isDisbursement && loan
        ? String(loan.principal_amount)
        : ""
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (busyRef.current) return;

    if (!submissionRef.current) {
      if (
        !/^\d{1,12}(\.\d{1,2})?$/.test(amount.trim()) ||
        Number(amount) <= 0
      ) {
        setError(
          "Enter a positive amount with at most two decimal places."
        );
        return;
      }

      submissionRef.current = {
        requestId: crypto.randomUUID(),
        action,
        memberId: isExpense ? null : memberId,
        loanId: isLoan ? loanId : null,
        amount: amount.trim(),
        paymentMethod,
        reference: reference.trim(),
        notes: notes.trim(),
      };
    }

    busyRef.current = true;
    setLoading(true);
    setLocked(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        "/api/transaction/record",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(submissionRef.current),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        // Only unlock when the server confirms rejection.
        if (result.canEdit === true) {
          submissionRef.current = null;
          setLocked(false);
        }

        throw new Error(
          result.error || "Unable to record the transaction."
        );
      }

      if (!result.success) {
        throw new Error(
          "The result could not be confirmed. Retry the same submission."
        );
      }

      submissionRef.current = null;
      setLocked(false);

      setSuccess(
        result.alreadyRecorded
          ? "This submission was already recorded. No duplicate was added."
          : "Transaction recorded successfully."
      );

      setMemberId("");
      setLoanId("");
      setAmount("");
      setReference("");
      setNotes("");

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to confirm the result. Retry the same submission."
      );
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white " +
    "px-4 py-3 text-gray-900 outline-none " +
    "focus:border-gray-700 focus:ring-1 focus:ring-gray-700 " +
    "disabled:bg-gray-100";

  const labelClass =
    "mb-2 block text-sm font-medium text-gray-700";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      {success && (
        <div
          role="status"
          className="mb-6 rounded-lg bg-green-50 p-4 text-sm text-green-800"
        >
          <p>{success}</p>

          <Link
            href="/transactions"
            className="mt-2 inline-block font-semibold underline"
          >
            View Transaction History
          </Link>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {locked && !loading && (
        <div className="mb-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          The result is uncertain, so the details are locked.
          Use “Retry Same Submission” below. Do not record
          the payment again in another form.
        </div>
      )}

      <fieldset
        disabled={loading || locked}
        className="min-w-0 space-y-5"
      >
        <div>
          <label htmlFor="action" className={labelClass}>
            Transaction Type
          </label>

          <select
            id="action"
            value={action}
            onChange={(event) =>
              changeAction(event.target.value)
            }
            className={inputClass}
          >
            <option value="contribution">
              Member Contribution — Money In
            </option>
            <option value="loan_disbursement">
              Loan Disbursement — Money Out
            </option>
            <option value="loan_repayment">
              Loan Repayment — Money In
            </option>
            <option value="expense">
              Group Expense — Money Out
            </option>
          </select>
        </div>

        {!isExpense && (
          <div>
            <label htmlFor="member" className={labelClass}>
              Member
            </label>

            <select
              id="member"
              value={memberId}
              onChange={(event) =>
                changeMember(event.target.value)
              }
              required
              className={inputClass}
            >
              <option value="">Select a member</option>

              {eligibleMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.member_number || "No number"}
                  {" — "}
                  {member.full_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {isLoan && (
          <div>
            <label htmlFor="loan" className={labelClass}>
              {isDisbursement
                ? "Approved Loan"
                : "Loan to Repay"}
            </label>

            <select
              id="loan"
              value={loanId}
              onChange={(event) =>
                changeLoan(event.target.value)
              }
              required
              disabled={!memberId}
              className={inputClass}
            >
              <option value="">Select a loan</option>

              {eligibleLoans.map((loan) => (
                <option key={loan.id} value={loan.id}>
                  {loan.id.slice(0, 8)}
                  {" · "}
                  {isDisbursement
                    ? `Principal: ${money(loan.principal_amount)}`
                    : `Balance: ${money(loan.balance)}`}
                  {" · "}
                  {loan.status.replace(/_/g, " ")}
                </option>
              ))}
            </select>

            {memberId && eligibleLoans.length === 0 && (
              <p className="mt-2 text-sm text-amber-700">
                {isDisbursement
                  ? "This member has no approved loan available for disbursement. Create and approve the loan in the Loans workflow first."
                  : "This member has no outstanding loan available for repayment."}
              </p>
            )}

            {selectedLoan && (
              <p className="mt-2 text-sm text-gray-600">
                Total repayable:{" "}
                {money(selectedLoan.total_amount)}
                {!isDisbursement &&
                  ` · Outstanding: ${money(selectedLoan.balance)}`}
              </p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="amount" className={labelClass}>
            Amount (KSh)
          </label>

          <input
            id="amount"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) =>
              setAmount(event.target.value)
            }
            readOnly={isDisbursement}
            required
            className={inputClass}
          />

          {isDisbursement && (
            <p className="mt-2 text-xs text-gray-500">
              The amount is the selected loan’s approved
              principal and cannot be edited here.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="method" className={labelClass}>
            Payment Method
          </label>

          <select
            id="method"
            value={paymentMethod}
            onChange={(event) =>
              setPaymentMethod(event.target.value)
            }
            className={inputClass}
          >
            <option value="cash">Cash</option>
            <option value="mpesa">M-Pesa</option>
            <option value="bank">Bank</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label htmlFor="reference" className={labelClass}>
            {paymentMethod === "mpesa"
              ? "M-Pesa Reference"
              : "Payment Reference (Optional)"}
          </label>

          <input
            id="reference"
            type="text"
            value={reference}
            onChange={(event) =>
              setReference(event.target.value)
            }
            required={paymentMethod === "mpesa"}
            maxLength={200}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="notes" className={labelClass}>
            {isExpense
              ? "Expense Description"
              : "Notes (Optional)"}
          </label>

          <textarea
            id="notes"
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            required={isExpense}
            maxLength={2000}
            rows={3}
            placeholder={
              isExpense
                ? "Explain what the group paid for."
                : "Additional information about this payment."
            }
            className={inputClass}
          />
        </div>

        <p className="text-sm text-gray-500">
          This records a payment that has already happened.
          It does not send money or initiate an M-Pesa
          payment. The recording time is saved automatically.
        </p>
      </fieldset>

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-lg bg-gray-900 px-5 py-3 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Recording…"
          : locked
            ? "Retry Same Submission"
            : "Record Transaction"}
      </button>
    </form>
  );
}