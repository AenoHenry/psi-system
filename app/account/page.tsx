import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PasswordForm from "./password-form";

export default async function AccountPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  return <PasswordForm />;
}