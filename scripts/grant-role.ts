// Gives an account the admin role (user_roles, migration 016), or takes it
// away. For the first admin; after that, admins grant it from a learner's page
// in /admin. The account must have signed up already.
//
//   node --env-file=.env.local --import tsx scripts/grant-role.ts you@example.com
//   node --env-file=.env.local --import tsx scripts/grant-role.ts you@example.com --remove

import { createClient } from "@supabase/supabase-js";

const [email, flag] = process.argv.slice(2);
if (!email) {
  console.error("Usage: scripts/grant-role.ts <email> [--remove]");
  process.exit(1);
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

async function main() {
  let user: { id: string; email?: string } | undefined;
  for (let page = 1; !user; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (data.users.length < 1000) break;
  }
  if (!user) {
    console.error(`No account for ${email}. Sign up first, then run this again.`);
    process.exit(1);
  }

  const { error } =
    flag === "--remove"
      ? await db.from("user_roles").delete().eq("user_id", user.id)
      : await db.from("user_roles").upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id" });
  if (error) throw error;
  console.log(flag === "--remove" ? `${email} is no longer an admin.` : `${email} is now an admin.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
