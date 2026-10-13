import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createClient as createAdminClient,
} from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    // 1. Verify the signed-in user.
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 }
      );
    }

    // 2. Only an active Chairperson can add members.
    const {
      data: currentMember,
      error: currentMemberError,
    } = await supabase
      .from("members")
      .select("id, role, status")
      .eq("user_id", user.id)
      .single();

    if (currentMemberError || !currentMember) {
      return NextResponse.json(
        {
          error:
            "Your account is not linked to a PSI member record.",
        },
        { status: 403 }
      );
    }

    if (
      currentMember.role !== "chairperson" ||
      currentMember.status !== "active"
    ) {
      return NextResponse.json(
        {
          error:
            "Only an active PSI Chairperson can add members.",
        },
        { status: 403 }
      );
    }

    // 3. Read and validate the form.
    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request. Please submit the form again." },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Invalid form data." },
        { status: 400 }
      );
    }

    const fullName =
      typeof body.fullName === "string"
        ? body.fullName.trim()
        : "";

    const phone =
      typeof body.phone === "string"
        ? body.phone.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const role =
      typeof body.role === "string"
        ? body.role.trim()
        : "member";

    if (!fullName) {
      return NextResponse.json(
        { error: "Full name is required." },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json(
        { error: "Phone number is required." },
        { status: 400 }
      );
    }

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const allowedRoles = [
      "member",
      "secretary",
      "treasurer",
    ];

    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid PSI role." },
        { status: 400 }
      );
    }

    // 4. Read server configuration.
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Use a configured address, not the request's Origin header.
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (
        process.env.NODE_ENV === "development"
          ? "http://localhost:3001"
          : ""
      );

    if (!supabaseUrl || !serviceRoleKey || !siteUrl) {
      console.error(
        "Missing Supabase credentials or site URL."
      );

      return NextResponse.json(
        {
          error:
            "Server configuration is incomplete. Check the Supabase settings and NEXT_PUBLIC_SITE_URL.",
        },
        { status: 500 }
      );
    }

    let redirectTo: string;

    try {
      const parsedSiteUrl = new URL(siteUrl);

      if (
        !["http:", "https:"].includes(
          parsedSiteUrl.protocol
        )
      ) {
        throw new Error("Unsupported site URL.");
      }

      redirectTo = new URL(
        "/activate",
        parsedSiteUrl.origin
      ).toString();
    } catch {
      return NextResponse.json(
        {
          error:
            "NEXT_PUBLIC_SITE_URL must be a valid website address.",
        },
        { status: 500 }
      );
    }

    // Never expose this admin client or key to the browser.
    const admin = createAdminClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 5. Check existing member email.
    const {
      data: existingMember,
      error: emailCheckError,
    } = await admin
      .from("members")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (emailCheckError) {
      console.error("EMAIL CHECK ERROR:", emailCheckError);

      return NextResponse.json(
        { error: "Could not check existing member emails." },
        { status: 500 }
      );
    }

    if (existingMember) {
      return NextResponse.json(
        {
          error:
            "A PSI member with this email already exists. Do not create them again.",
        },
        { status: 409 }
      );
    }

    // 6. Check existing phone number.
    const {
      data: existingPhone,
      error: phoneCheckError,
    } = await admin
      .from("members")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (phoneCheckError) {
      console.error("PHONE CHECK ERROR:", phoneCheckError);

      return NextResponse.json(
        { error: "Could not check existing phone numbers." },
        { status: 500 }
      );
    }

    if (existingPhone) {
      return NextResponse.json(
        {
          error:
            "A PSI member with this phone number already exists.",
        },
        { status: 409 }
      );
    }

    // 7. Keep your existing PSI001 numbering format.
    //
    // This calculation is not safe for concurrent additions.
    // Before production, use a database sequence and unique
    // constraints for member_number, user_id, and email.
    const {
      data: existingNumbers,
      error: numbersError,
    } = await admin
      .from("members")
      .select("member_number");

    if (numbersError) {
      console.error("MEMBER NUMBER ERROR:", numbersError);

      return NextResponse.json(
        { error: "Could not generate the PSI member number." },
        { status: 500 }
      );
    }

    let highestNumber = 0;

    for (const member of existingNumbers ?? []) {
      const value = member.member_number;

      if (typeof value !== "string") continue;

      const match = value.match(/^PSI(\d+)$/i);

      if (match) {
        highestNumber = Math.max(
          highestNumber,
          Number(match[1])
        );
      }
    }

    const memberNumber =
      `PSI${String(highestNumber + 1).padStart(3, "0")}`;

    // 8. Invite the member directly.
    //
    // Supabase creates the invited Auth account.
    // No temporary password is needed.
    const {
      data: inviteData,
      error: inviteError,
    } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo,
        data: {
          full_name: fullName,
          phone,
        },
      }
    );

    if (inviteError || !inviteData.user) {
      console.error("INVITATION ERROR:", inviteError);

      return NextResponse.json(
        {
          error:
            inviteError?.message ||
            "Could not send the member invitation.",
        },
        { status: 400 }
      );
    }

    const invitedUserId = inviteData.user.id;

    // 9. Link the PSI record to the invited Auth account.
    // Authorization roles belong in the members table,
    // not in user-editable Auth metadata.
    const {
      data: newMember,
      error: memberInsertError,
    } = await admin
      .from("members")
      .insert({
        user_id: invitedUserId,
        member_number: memberNumber,
        full_name: fullName,
        phone,
        email,
        role,
        status: "active",
        join_date: new Date()
          .toISOString()
          .split("T")[0],
      })
      .select(
        "id, user_id, member_number, full_name, phone, email, role, status, join_date"
      )
      .single();

    if (memberInsertError || !newMember) {
      console.error("MEMBER INSERT ERROR:", {
        userId: invitedUserId,
        error: memberInsertError,
      });

      // Auth and database changes are not one transaction.
      // Do not automatically delete an account here:
      // an invitation may already have been delivered, and
      // the returned account could have existed previously.
      return NextResponse.json(
        {
          error:
            "The invitation was sent, but the PSI member record could not be saved. Do not submit this member again yet. The account and member record need to be checked.",
        },
        { status: 500 }
      );
    }

    // 10. Success.
    return NextResponse.json(
      {
        success: true,
        message:
          "An invitation email has been sent. The member can use it to set their password.",
        member: newMember,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("CREATE MEMBER ERROR:", error);

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred. Check the server terminal before trying again.",
      },
      { status: 500 }
    );
  }
}