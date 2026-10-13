"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = {
  success: boolean;
  error?: string;
  canEdit?: boolean;
  alreadyDone?: boolean;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function officerSession() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { supabase, allowed: false };
  const { data: member, error } = await supabase
    .from("members")
    .select("id, role, status")
    .eq("user_id", user.id)
    .single();
  return {
    supabase,
    allowed:
      !error &&
      !!member &&
      member.status === "active" &&
      ["chairperson", "treasurer"].includes(member.role),
  };
}

function databaseFailure(error: {
  code?: string;
  message: string;
}): ActionResult {
  const code = error.code ?? "";
  const rejected = /^[0-9A-Z]{5}$/.test(code) && !code.startsWith("08");
  console.error("LOAN DATABASE ERROR:", error);
  return {
    success: false,
    canEdit: rejected,
    error:
      code === "P0001"
        ? error.message
        : rejected
          ? "The database rejected this operation. Check the server terminal for details."
          : "The result could not be confirmed. Retry the same submission without changing its details.",
  };
}

function refreshPages() {
  revalidatePath("/loans");
  revalidatePath("/transactions");
  revalidatePath("/transactions/add");
  revalidatePath("/dashboard");
}

export async function createLoan(input: {
  requestId: string;
  memberId: string;
  principal: string;
  purpose: string;
}): Promise<ActionResult> {
  try {
    const { supabase, allowed } = await officerSession();
    if (!allowed)
      return {
        success: false,
        canEdit: true,
        error: "Only an active Chairperson or Treasurer can create loans.",
      };
    if (
      !input ||
      typeof input.requestId !== "string" ||
      typeof input.memberId !== "string" ||
      !uuidPattern.test(input.requestId) ||
      !uuidPattern.test(input.memberId)
    ) {
      return {
        success: false,
        canEdit: true,
        error: "Select a valid member and submission ID.",
      };
    }
    const principal =
      typeof input.principal === "string" ? input.principal.trim() : "";
    const purpose =
      typeof input.purpose === "string" ? input.purpose.trim() : "";
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(principal) || Number(principal) <= 0) {
      return {
        success: false,
        canEdit: true,
        error: "Enter a positive principal with at most two decimal places.",
      };
    }
    if (!purpose || purpose.length > 2000)
      return {
        success: false,
        canEdit: true,
        error: "Enter a purpose of no more than 2000 characters.",
      };
    const { data, error } = await supabase.rpc("psi_create_loan", {
      p_request_id: input.requestId,
      p_member_id: input.memberId,
      p_principal: principal,
      p_purpose: purpose,
    });
    if (error) return databaseFailure(error);
    if (!data?.success)
      return {
        success: false,
        canEdit: false,
        error: "The result could not be confirmed. Retry the same submission.",
      };
    refreshPages();
    return { success: true, alreadyDone: !!data.already_created };
  } catch (error) {
    console.error("CREATE LOAN ACTION ERROR:", error);
    return {
      success: false,
      canEdit: false,
      error:
        "The result could not be confirmed. Retry the same submission without changing its details.",
    };
  }
}

export async function reviewLoan(
  loanId: string,
  decision: "approved" | "rejected",
): Promise<ActionResult> {
  try {
    const { supabase, allowed } = await officerSession();
    if (!allowed)
      return {
        success: false,
        canEdit: true,
        error: "Only an active Chairperson or Treasurer can review loans.",
      };
    if (
      typeof loanId !== "string" ||
      !uuidPattern.test(loanId) ||
      !["approved", "rejected"].includes(decision)
    ) {
      return { success: false, canEdit: true, error: "Invalid loan decision." };
    }
    const { data, error } = await supabase.rpc("psi_review_loan", {
      p_loan_id: loanId,
      p_decision: decision,
    });
    if (error) return databaseFailure(error);
    if (!data?.success)
      return {
        success: false,
        canEdit: false,
        error: "The result could not be confirmed. Retry the same decision.",
      };
    refreshPages();
    return { success: true, alreadyDone: !!data.already_reviewed };
  } catch (error) {
    console.error("REVIEW LOAN ACTION ERROR:", error);
    return {
      success: false,
      canEdit: false,
      error: "The result could not be confirmed. Retry the same decision.",
    };
  }
}
