import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AddMemberForm from "./add-member-form";

export const dynamic = "force-dynamic";

export default async function AddMemberPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, role, status")
    .eq("user_id", user.id)
    .single();

  if (
    memberError ||
    !member ||
    member.role !== "chairperson" ||
    member.status !== "active"
  ) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Access Restricted
          </h1>
          <p className="mt-3 text-gray-600">
            Only an active PSI Chairperson can add members and send invitations.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            The member creation form is not available to this account.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return <AddMemberForm />;
}
