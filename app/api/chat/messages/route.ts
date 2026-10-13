import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const fields = "id, sender_member_id, body, created_at";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user)
      return NextResponse.json(
        { error: "Please log in to send messages.", canEdit: true },
        { status: 401 },
      );
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id, status")
      .eq("user_id", user.id)
      .single();
    if (memberError || !member || member.status !== "active")
      return NextResponse.json(
        { error: "Only active PSI members can send messages.", canEdit: true },
        { status: 403 },
      );
    let input;
    try {
      input = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request.", canEdit: true },
        { status: 400 },
      );
    }
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      typeof input.messageId !== "string" ||
      !uuidPattern.test(input.messageId) ||
      typeof input.body !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid message details.", canEdit: true },
        { status: 400 },
      );
    }
    const body = input.body.trim();
    if ([...body].length < 1 || [...body].length > 2000)
      return NextResponse.json(
        {
          error: "Enter a message between 1 and 2000 characters.",
          canEdit: true,
        },
        { status: 400 },
      );
    const { data: message, error } = await supabase
      .from("group_messages")
      .insert({ id: input.messageId, sender_member_id: member.id, body })
      .select(fields)
      .single();
    if (!error && message)
      return NextResponse.json({ success: true, message, alreadySent: false });

    // A retried message uses the same UUID, not another insert.
    if (error?.code === "23505") {
      const { data: existing, error: lookupError } = await supabase
        .from("group_messages")
        .select(fields)
        .eq("id", input.messageId)
        .single();
      if (!lookupError && existing) {
        if (existing.sender_member_id === member.id && existing.body === body) {
          return NextResponse.json({
            success: true,
            message: existing,
            alreadySent: true,
          });
        }
        return NextResponse.json(
          {
            error: "This message ID is already in use. Nothing new was sent.",
            canEdit: true,
          },
          { status: 409 },
        );
      }
      return NextResponse.json(
        {
          error: "The result is uncertain. Retry the same message.",
          canEdit: false,
        },
        { status: 503 },
      );
    }
    console.error("CHAT SEND ERROR:", error);
    const code = error?.code ?? "";
    const rejected = /^[0-9A-Z]{5}$/.test(code) && !code.startsWith("08");
    return NextResponse.json(
      {
        error:
          code === "P0001"
            ? error!.message
            : rejected
              ? "The message was rejected. Check the server terminal for details."
              : "The result is uncertain. Retry the same message.",
        canEdit: rejected,
      },
      { status: rejected ? 400 : 503 },
    );
  } catch (error) {
    console.error("CHAT API ERROR:", error);
    return NextResponse.json(
      {
        error: "The result is uncertain. Retry the same message.",
        canEdit: false,
      },
      { status: 503 },
    );
  }
}
