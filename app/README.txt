PSI LOAN WORKFLOW — INSTALLATION

Prerequisite: The loan setup SQL from the chat must have completed successfully.

1. Back up your existing psi-system/app/loans/page.tsx outside the app folder.
2. Copy these three files from this package into your project:
   app/loans/actions.ts                (new backend server actions)
   app/loans/loan-management.tsx        (new creation and review controls)
   app/loans/page.tsx                  (replace existing Loans page)
3. Keep all three files directly inside app/loans. Do not put them in an add folder.
4. Leave your existing lib/supabase files and transaction recording files unchanged.
5. Save all files and open http://localhost:3001/loans.

This workflow uses Next.js Server Actions. No new app/api/loans route is required.
No environment values or secret keys are included in this package.

EXPECTED WORKFLOW
- An active Chairperson or Treasurer creates a pending loan.
- An active Chairperson or Treasurer approves or rejects it.
- Approval checks borrowing capacity and applies one-time 10% interest.
- Approval does not send money or create a disbursement transaction.
- Use Record Transaction > Loan Disbursement to record money actually lent.
- Use Record Transaction > Loan Repayment to record money actually received.
- The database sets the due date to 21 days after disbursement.
- Pending and approved loans are excluded from outstanding-debt summaries.

VALIDATION
The code was parsed and formatted locally. It has not been built or run inside
your actual Next.js project, and the database functions were not executed by the assistant.

CONTROLLED TEST (TEST DATABASE OR CLEARLY DESIGNATED TEST MEMBERS ONLY)
- First check that /loans loads without errors. Do not fabricate live payments.
- Confirm an active Secretary or ordinary member cannot see management controls.
- As a financial officer, use a test member with confirmed contributions.
- Create a loan within the permitted limit; verify exactly one pending record.
- Approve; verify status approved and no money-out transaction yet.
- After a legitimate/test disbursement, record it once via Record Transaction.
- Verify balance = principal + one-time interest, due date +21 days, and one transaction.
- Record a partial repayment; verify one repayment, one transaction, and updated balance.
- A repayment above the outstanding balance must fail without creating records.
- Test a principal above the borrowing limit; it must fail.

LIMITATIONS / REMAINING REVIEW
- Existing financial records are not corrected or backfilled automatically.
- Approval does not reserve funds. Capacity is rechecked at disbursement.
- The database dates use the recorded disbursement timestamp. History displays Kenya time.
- Loan review records the latest reviewer; this is not a separate immutable audit-event log.
- The new loan-creation retry ID is retained only while its page remains open.
  If a result is uncertain, keep the page open and retry the same request.
  After reload, check Loan History before creating another loan.
- Summaries apply to the rows loaded. Supabase result limits/pagination need review as records grow.
- No automatic job marks loans overdue; existing overdue statuses are supported.
- Contributions and repayments pages still need review for older direct-write paths.
- This setup records payments; it does not initiate bank or M-Pesa transfers.
