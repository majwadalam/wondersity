"use client";

import { Activity, BookOpen, Briefcase, Database, Gauge, TriangleAlert, Users, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: [string, string, LucideIcon][] = [
  ["/admin", "Overview", Gauge],
  ["/admin/money", "Money", Wallet],
  ["/admin/users", "Learners", Users],
  ["/admin/courses", "Courses", BookOpen],
  ["/admin/runs", "AI activity", Activity],
  ["/admin/problems", "Problems", TriangleAlert],
  ["/admin/cache", "Saved for reuse", Database],
  ["/admin/billing", "Subscriptions", Briefcase],
];

export function AdminNav() {
  const pathname = usePathname();
  const active = (href: string) => (href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {NAV.map(([href, label, Icon]) => (
        <Link
          key={href}
          href={href}
          aria-current={active(href) ? "page" : undefined}
          className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors ${
            active(href) ? "bg-accent-soft text-accent" : "text-muted hover:bg-canvas hover:text-fg"
          }`}
        >
          <Icon size={16} aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
