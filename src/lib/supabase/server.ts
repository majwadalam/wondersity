import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireEnv } from "../env";

/**
 * Supabase as the signed-in learner, from the session cookies. Queries run
 * as that user, so the database's row rules (own rows only) apply.
 */
export async function serverSupabase() {
  const store = await cookies();
  return createServerClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a server component, where cookies are read-only; the proxy refreshes them.
        }
      },
    },
  });
}
