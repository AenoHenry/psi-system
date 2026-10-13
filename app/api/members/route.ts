import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    // --------------------------------------------------
    // 1. Check logged-in user
    // --------------------------------------------------
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "You must be logged in.",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 2. Get current PSI member
    // --------------------------------------------------
    const { data: currentMember, error: currentMemberError } =
      await supabase
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

    // --------------------------------------------------
    // 3. Only Chairperson can add members
    // --------------------------------------------------
    if (currentMember.role !== "chairperson") {
      return NextResponse.json(
        {
          error:
            "Only the Chairperson can add new members.",
        },
        { status: 403 }
      );
    }

    if (currentMember.status !== "active") {
      return NextResponse.json(
        {
          error:
            "Your PSI membership is not active.",
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // 4. Read request
    // --------------------------------------------------
    const body = await request.json();

    const fullName = String(
      body.fullName ?? ""
    ).trim();

    const phone = String(
      body.phone ?? ""
    ).trim();

    const email = String(
      body.email ?? ""
    )
      .trim()
      .toLowerCase();

    if (!fullName) {
      return NextResponse.json(
        {
          error: "Full name is required.",
        },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          error: "Email address is required.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 5. Server Supabase credentials
    // --------------------------------------------------
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Supabase server configuration is missing. Check SUPABASE_SERVICE_ROLE_KEY in .env.local.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 6. Admin client
    // --------------------------------------------------
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

    // --------------------------------------------------
    // 7. Check existing PSI member
    // --------------------------------------------------
    const { data: existingMember, error: existingError } =
      await admin
        .from("members")
        .select("id, email")
        .ilike("email", email)
        .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        {
          error:
            "Unable to check existing members: " +
            existingError.message,
        },
        { status: 500 }
      );
    }

    if (existingMember) {
      return NextResponse.json(
        {
          error:
            "A PSI member with this email address already exists.",
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------
    // 8. Generate PSI member number
    // --------------------------------------------------
    const { data: lastMember, error: lastMemberError } =
      await admin
        .from("members")
        .select("member_number")
        .not("member_number", "is", null)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (lastMemberError) {
      return NextResponse.json(
        {
          error:
            "Could not generate the PSI member number: " +
            lastMemberError.message,
        },
        { status: 500 }
      );
    }

    let nextNumber = 1;

    if (lastMember?.member_number) {
      const match =
        lastMember.member_number.match(/(\d+)$/);

      if (match) {
        nextNumber =
          Number(match[1]) + 1;
      }
    }

    const memberNumber =
      `PSI-${String(nextNumber).padStart(4, "0")}`;

    // --------------------------------------------------
    // 9. Create Auth account
    // --------------------------------------------------
    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: {
          full_name: fullName,
          phone: phone || null,
          member_number: memberNumber,
        },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          error:
            authError?.message ??
            "Failed to create the member account.",
        },
        { status: 400 }
      );
    }

    const newUser = authData.user;

    // --------------------------------------------------
    // 10. Create PSI member record
    // --------------------------------------------------
    const { data: newMember, error: insertError } =
      await admin
        .from("members")
        .insert({
          user_id: newUser.id,
          member_number: memberNumber,
          full_name: fullName,
          phone: phone || null,
          email,
          role: "member",
          status: "active",
          join_date: new Date()
            .toISOString()
            .split("T")[0],
        })
        .select(
          "id, user_id, member_number, full_name, phone, email, role, status, join_date"
        )
        .single();

    // --------------------------------------------------
    // 11. Roll back Auth account if member creation fails
    // --------------------------------------------------
    if (insertError || !newMember) {
      await admin.auth.admin.deleteUser(
        newUser.id
      );

      return NextResponse.json(
        {
          error:
            insertError?.message ??
            "Failed to create the PSI member record.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 12. Determine invitation redirect
    // --------------------------------------------------
    const origin =
      request.headers.get("origin") ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      "http://localhost:3001";

    const redirectTo =
      `${origin}/auth/reset-password`;

    // --------------------------------------------------
    // 13. Send invitation
    // --------------------------------------------------
    const { error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo,
        }
      );

    // --------------------------------------------------
    // 14. If invitation failed
    // --------------------------------------------------
    if (inviteError) {
      return NextResponse.json(
        {
          success: true,
          warning:
            "The member was created, but the invitation email could not be sent.",
          inviteError:
            inviteError.message,
          member: newMember,
        },
        { status: 201 }
      );
    }

    // --------------------------------------------------
    // 15. Success
    // --------------------------------------------------
    return NextResponse.json(
      {
        success: true,
        message:
          "Member created successfully. An invitation email has been sent.",
        member: newMember,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "ADD MEMBER ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}