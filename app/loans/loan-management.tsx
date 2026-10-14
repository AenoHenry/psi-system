"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createLoan, reviewLoan } from "./actions";

type Member = { id: string; member_number: string | null; full_name: string };
type PendingLoan = {
  id: string;
  member_name: string;
  member_number: string;
  principal_amount: number | string;
  purpose: string | null;
};
type Submission = {
  requestId: string;
  memberId: string;
  principal: string;
  purpose: string;
};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700 disabled:bg-gray-100";
const labelClass = "mb-2 block text-sm font-medium text-gray-700";

function money(value: number | string) {
  return `KSh ${Number(value).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
}

export default function LoanManagement({
  members,
  pendingLoans,
}: {
  members: Member[];
  pendingLoans: PendingLoan[];
}) {
  const router = useRouter();
  const [memberId, setMemberId] = useState("");
  const [principal, setPrincipal] = useState("");
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const submissionRef = useRef<Submission | null>(null);
  const busyRef = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    if (!submissionRef.current) {
      if (
        !/^\d{1,12}(\.\d{1,2})?$/.test(principal.trim()) ||
        Number(principal) <= 0
      ) {
        setError("Enter a positive principal with at most two decimal places.");
        return;
      }
      submissionRef.current = {
        requestId: crypto.randomUUID(),
        memberId,
        principal: principal.trim(),
        purpose: purpose.trim(),
      };
    }
    busyRef.current = true;
    setLoading(true);
    setLocked(true);
    setError("");
    setSuccess("");
    try {
      const result = await createLoan(submissionRef.current);
      if (!result.success) {
        if (result.canEdit === true) {
          submissionRef.current = null;
          setLocked(false);
        }
        throw new Error(result.error || "Unable to create the loan.");
      }
      submissionRef.current = null;
      setLocked(false);
      setMemberId("");
      setPrincipal("");
      setPurpose("");
      setSuccess(
        result.alreadyDone
          ? "This loan was already created. No duplicate was added."
          : "Pending loan created. Review it below; no money has been disbursed.",
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to confirm the result. Retry the same submission.",
      );
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }

  return (
    <section className="mb-8 space-y-6">
      <form
        onSubmit={submit}
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-xl font-semibold text-gray-900">Create Loan</h2>
        <p className="mt-2 text-sm text-gray-600">
          Create a pending loan for an active member. The database checks the
          borrowing limit. Approval applies one-time 10% interest. The 21-day
          deadline starts at disbursement.
        </p>
        {success && (
          <p
            role="status"
            className="mt-4 rounded-lg bg-green-50 p-4 text-sm text-green-800"
          >
            {success}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </p>
        )}
        {locked && !loading && (
          <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
            The result is uncertain. Keep this page open and retry the same
            submission below. Do not recreate this loan in another tab or after
            refreshing without checking Loan History first.
          </p>
        )}
        <fieldset
          disabled={loading || locked}
          className="mt-6 min-w-0 space-y-5"
        >
          <div>
            <label htmlFor="loan-member" className={labelClass}>
              Member
            </label>
            <select
              id="loan-member"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              required
              className={inputClass}
            >
              <option value="">Select an active member</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.member_number || "No number"} — {member.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="loan-principal" className={labelClass}>
              Principal (KSh)
            </label>
            <input
              id="loan-principal"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="loan-purpose" className={labelClass}>
              Loan Purpose
            </label>
            <textarea
              id="loan-purpose"
              required
              maxLength={2000}
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className={inputClass}
            />
          </div>
        </fieldset>
        <button
          type="submit"
          disabled={loading}
          className="mt-6 rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {loading
            ? "Creating…"
            : locked
              ? "Retry Same Submission"
              : "Create Pending Loan"}
        </button>
      </form>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Pending Loan Reviews
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Approval does not disburse money. Either active financial officer may
          review a pending loan.
        </p>
        {pendingLoans.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            No pending loans available to review.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {pendingLoans.map((loan) => (
              <LoanReview key={loan.id} loan={loan} />
            ))}
          </div>
        )}
      </div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <h2 className="font-semibold text-blue-900">
          Disbursements and Repayments
        </h2>
        <p className="mt-2 text-sm text-blue-800">
          After approval, use Record Transaction and select Loan Disbursement.
          For money received against a loan, select Loan Repayment. Do not
          create a second loan for a repayment.
        </p>
        <Link
          href="/transactions/add"
          className="mt-4 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Record Transaction
        </Link>
      </div>
    </section>
  );
}

function LoanReview({ loan }: { loan: PendingLoan }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState("");
  const [retryDecision, setRetryDecision] = useState<
    "approved" | "rejected" | null
  >(null);
  const busyRef = useRef(false);

  async function decide(decision: "approved" | "rejected") {
    if (busyRef.current || completed) return;
    if (
      !retryDecision &&
      !window.confirm(
        `${decision === "approved" ? "Approve" : "Reject"} this ${money(loan.principal_amount)} loan for ${loan.member_name}? Approval does not send money.`,
      )
    )
      return;
    busyRef.current = true;
    setLoading(true);
    setError("");
    setRetryDecision(decision);
    try {
      const result = await reviewLoan(loan.id, decision);
      if (!result.success) {
        if (result.canEdit === true) setRetryDecision(null);
        throw new Error(result.error || "Unable to review this loan.");
      }
      setRetryDecision(null);
      setCompleted(
        decision === "approved"
          ? "Loan approved. Ready for disbursement."
          : "Loan rejected.",
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The result is uncertain. Retry the same decision.",
      );
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="font-semibold text-gray-900">
        {loan.member_number} — {loan.member_name}
      </p>
      <p className="mt-1 text-sm text-gray-600">
        Loan {loan.id.slice(0, 8)} · Principal: {money(loan.principal_amount)}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
        {loan.purpose || "No purpose recorded"}
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {completed ? (
        <p role="status" className="mt-3 text-sm text-green-700">
          {completed}
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          {retryDecision ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => decide(retryDecision)}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading
                ? "Saving…"
                : `Retry ${retryDecision === "approved" ? "Approval" : "Rejection"}`}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={() => decide("approved")}
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => decide("rejected")}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
