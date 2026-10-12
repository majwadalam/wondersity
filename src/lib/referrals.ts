// Creator referrals (docs/CREATORS.md). A visitor arriving with ?ref=<code>,
// or on a creator's companion page (/c/<slug>), gets a first-party cookie for
// 30 days; the first referral wins. The code is only trusted once checked
// against the partners table: when the learner finishes onboarding (saved on
// their profile) and when they buy (sent through Paddle checkout and saved on
// the subscription).

export const REF_COOKIE = "agora_ref";
export const REF_DAYS = 30;

const CODE = /^[a-z0-9][a-z0-9-]{1,30}$/;

/** A referral code as written in a link, normalized, or null if it can't be one. */
export function cleanRefCode(raw: string | null | undefined): string | null {
  const code = raw?.trim().toLowerCase() ?? "";
  return CODE.test(code) ? code : null;
}

/** The referral code in a Cookie header, if any. */
export function refFromCookieHeader(header: string | null): string | null {
  const match = header?.split(/;\s*/).find((c) => c.startsWith(`${REF_COOKIE}=`));
  return match ? cleanRefCode(decodeURIComponent(match.slice(REF_COOKIE.length + 1))) : null;
}

/** Sets the referral cookie in the browser unless one is already set (first referral wins). */
export function rememberRefInBrowser(code: string) {
  if (typeof document === "undefined" || refFromCookieHeader(document.cookie)) return;
  document.cookie = `${REF_COOKIE}=${encodeURIComponent(code)}; Max-Age=${REF_DAYS * 86400}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}
