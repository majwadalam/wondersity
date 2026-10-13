import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { REF_COOKIE, REF_DAYS, cleanRefCode } from "@/lib/referrals";

// Keeps the Supabase session fresh on every page load and sends signed-out
// visitors from the app to sign in (and signed-in ones from /login to the
// app). An optimistic check only: every API route verifies the user again.
// Also remembers a creator's referral code from ?ref= (see lib/referrals.ts).

const APP = ["/home", "/courses", "/progress", "/review", "/library", "/settings", "/welcome", "/admin"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const redirect = (to: string) => {
    const r = NextResponse.redirect(new URL(to, request.url));
    for (const c of response.cookies.getAll()) r.cookies.set(c);
    return r;
  };
  if (!data.user && APP.some((p) => path === p || path.startsWith(`${p}/`))) {
    return redirect(`/login?next=${encodeURIComponent(path + request.nextUrl.search)}`);
  }
  if (data.user && path === "/login") return redirect("/home");

  // First referral wins: an existing cookie is kept. The code is checked
  // against the partners table later, before it counts for anything.
  const ref = cleanRefCode(request.nextUrl.searchParams.get("ref"));
  if (ref && !request.cookies.get(REF_COOKIE)) {
    response.cookies.set(REF_COOKIE, ref, { maxAge: REF_DAYS * 86400, path: "/", sameSite: "lax", secure: request.nextUrl.protocol === "https:" });
  }
  return response;
}

export const config = {
  // Pages only: not API routes (they check for themselves), static files or images.
  matcher: ["/((?!api|_next/static|_next/image|art|lottie|audio|favicon|icon|apple-icon|sw\\.js|.*\\.(?:svg|png|jpg|webp|json|m4a)$).*)"],
};
