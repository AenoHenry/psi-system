import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Please log in first.",
          canEdit: true,
        },
        { status: 401 }
      );
    }

    const { data: member, error: memberError } =
      await supabase
        .from("members")
        .select("id, role, status")
        .eq("user_id", user.id)
        .single();

    if (
      memberError ||
      !member ||
      member.status !== "active" ||
      !["chairperson", "treasurer"].includes(member.role)
    ) {
      return NextResponse.json(
        {
          error:
            "Only an active Chairperson or Treasurer can record transactions.",
          canEdit: true,
        },
        { status: 403 }
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request.", canEdit: true },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid form data.", canEdit: true },
        { status: 400 }
      );
    }

    const actions = [
      "contribution",
      "loan_disbursement",
      "loan_repayment",
      "expense",
    ];

    const methods = ["cash", "mpesa", "bank", "other"];

    if (
      typeof body.requestId !== "string" ||
      !uuidPattern.test(body.requestId) ||
      !actions.includes(body.action) ||
      !methods.includes(body.paymentMethod)
    ) {
      return NextResponse.json(
        {
          error: "Invalid transaction details.",
          canEdit: true,
        },
        { status: 400 }
      );
    }

    // Keep the amount as a decimal string when sending it
    // to PostgreSQL, which performs the financial arithmetic.
    const amount =
      typeof body.amount === "string"
        ? body.amount.trim()
        : "";

    if (
      !/^\d{1,12}(\.\d{1,2})?$/.test(amount) ||
      Number(amount) <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Enter a positive amount with at most two decimal places.",
          canEdit: true,
        },
        { status: 400 }
      );
    }

    const isExpense = body.action === "expense";
    const isLoan =
      body.action === "loan_disbursement" ||
      body.action === "loan_repayment";

    const memberId = isExpense ? null : body.memberId;
    const loanId = isLoan ? body.loanId : null;

    if (
      (!isExpense &&
        (typeof memberId !== "string" ||
          !uuidPattern.test(memberId))) ||
      (isLoan &&
        (typeof loanId !== "string" ||
          !uuidPattern.test(loanId)))
    ) {
      return NextResponse.json(
        {
          error: "Select the member and, if applicable, the loan.",
          canEdit: true,
        },
        { status: 400 }
      );
    }

    const reference =
      typeof body.reference === "string"
        ? body.reference.trim()
        : "";

    const notes =
      typeof body.notes === "string"
        ? body.notes.trim()
        : "";

    if (reference.length > 200 || notes.length > 2000) {
      return NextResponse.json(
        {
          error: "Reference or notes are too long.",
          canEdit: true,
        },
        { status: 400 }
      );
    }

    if (body.paymentMethod === "mpesa" && !reference) {
      return NextResponse.json(
        {
          error: "Enter the M-Pesa reference.",
          canEdit: true,
        },
        { status: 400 }
      );
    }

    if (isExpense && !notes) {
      return NextResponse.json(
        {
          error: "Describe what the expense was for.",
          canEdit: true,
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc(
      "psi_record_transaction",
      {
        p_request_id: body.requestId,
        p_action: body.action,
        p_amount: amount,
        p_member_id: memberId,
        p_loan_id: loanId,
        p_payment_method: body.paymentMethod,
        p_reference: reference || null,
        p_notes: notes || null,
        p_transaction_date: null,
      }
    );

    if (error) {
      console.error("RECORD TRANSACTION ERROR:", error);

      // A PostgreSQL error response means the operation failed.
      // Network failures are uncertain, so retain the same
      // submission ID for a safe retry.
      const databaseRejected =
        /^[0-9A-Z]{5}$/.test(error.code || "") &&
        !error.code.startsWith("08");

      return NextResponse.json(
        {
          error:
            error.code === "P0001"
              ? error.message
              : databaseRejected
                ? "The database rejected this transaction. Check the server terminal for details."
                : "The result could not be confirmed. Retry the same submission without changing its details.",
          canEdit: databaseRejected,
        },
        { status: databaseRejected ? 400 : 503 }
      );
    }

    if (!data?.success) {
      return NextResponse.json(
        {
          error:
            "The result could not be confirmed. Retry the same submission.",
          canEdit: false,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      transactionId: data.transaction_id,
      alreadyRecorded: data.already_recorded,
    });
  } catch (error) {
    console.error("TRANSACTION API ERROR:", error);

    return NextResponse.json(
      {
        error:
          "The result could not be confirmed. Retry the same submission without changing its details.",
        canEdit: false,
      },
      { status: 500 }
    );
  }
}