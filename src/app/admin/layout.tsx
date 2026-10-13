import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { LogoMark, Wordmark } from "@/components/app/Brand";
import { requireAdmin } from "@/lib/admin";

// The admin panel: every learner, course, run and cost. Only for learners with
// the admin role (user_roles, lib/admin.ts); everyone else gets a 404. Each page checks again, since a
// layout doesn't re-run on every navigation.

export const metadata: Metadata = { title: "Admin · Wondersity", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-screen bg-canvas md:flex">
      <aside className="border-b border-line bg-surface px-3 py-3 md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-r md:border-b-0 md:px-4 md:py-6">
        <div className="mb-3 flex items-center justify-between gap-3 px-2 md:mb-7 md:block">
          <Link href="/admin" className="flex items-center gap-2" aria-label="Wondersity admin">
            <LogoMark size={26} />
            <Wordmark className="text-[17px]" />
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold tracking-wide text-accent uppercase">admin</span>
          </Link>
          <p className="truncate text-[12px] text-muted md:mt-2 md:pl-0.5">{admin.email}</p>
        </div>
        <AdminNav />
        <Link href="/home" className="mt-auto hidden border-t border-line px-3 pt-4 text-[13px] text-muted hover:text-fg md:block">
          ← Back to the app
        </Link>
      </aside>
      <main className="min-w-0 flex-1 px-4 pt-8 pb-24 sm:px-8 lg:px-10">
        <div className="max-w-[1600px]">{children}</div>
      </main>
    </div>
  );
}
