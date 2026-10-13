import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  const { data: members, error } = await supabase
    .from("members")
    .select("id, member_number, full_name, role, status")
    .order("member_number");

  return (
    <main style={{ padding: "40px", fontFamily: "Arial, sans-serif" }}>
      <h1>PSI Savings Group</h1>

      <p>Supabase connection test</p>

      {error && (
        <div style={{ color: "red", marginTop: "20px" }}>
          Database error: {error.message}
        </div>
      )}

      {!error && (
        <>
          <h2 style={{ marginTop: "30px" }}>
            Members: {members?.length ?? 0}
          </h2>

          <ul>
            {members?.map((member) => (
              <li key={member.id} style={{ marginBottom: "10px" }}>
                <strong>{member.member_number}</strong>{" "}
                {member.full_name} — {member.role}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}