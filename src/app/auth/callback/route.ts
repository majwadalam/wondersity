import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";

// Where the email link and Google send the learner back: trade the one-time
// code for a session, then continue to where they were going.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (code) {
    const supabase = await serverSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    // The link only works in the browser that asked for it (it holds the other half of the code).
    if (/verifier/i.test(error.message)) return NextResponse.redirect(new URL("/login?error=browser", url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}

/** Only same-site paths, so the link can't be used to send people elsewhere. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
}
