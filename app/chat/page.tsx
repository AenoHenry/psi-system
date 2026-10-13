import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GroupChat from "./group-chat";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, full_name, status")
    .eq("user_id", user.id)
    .single();
  if (memberError || !member || member.status !== "active")
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-3xl rounded-xl border bg-white p-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Group Chat Access Restricted
          </h1>
          <p className="mt-3 text-gray-600">
            Only active, signed-in PSI members can read or send group messages.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-block font-semibold underline"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  const [messageResult, memberResult] = await Promise.all([
    supabase
      .from("group_messages")
      .select("id, sender_member_id, body, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50),
    supabase.from("members").select("id, full_name").order("full_name"),
  ]);
  if (messageResult.error || memberResult.error) {
    console.error("CHAT LOAD ERROR:", {
      messages: messageResult.error,
      members: memberResult.error,
    });
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-3xl rounded-xl border bg-white p-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Unable to Load Group Chat
          </h1>
          <p className="mt-3 text-gray-600">
            Check the server terminal for details. No messages were changed.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-block font-semibold underline"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-gray-900">
          PSI Group Chat
        </h1>
        <p className="mt-2 text-gray-600">
          Discuss group issues as {member.full_name}. Messages are visible to
          all active PSI members.
        </p>
        <div className="mt-6">
          <GroupChat
            initialMessages={messageResult.data ?? []}
            members={memberResult.data ?? []}
            currentMemberId={member.id}
          />
        </div>
      </div>
    </main>
  );
}
