import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** A quiet "back to" link: an arrow icon aligned with its label, nudged left on hover. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group -ml-2 inline-flex max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-fg"
    >
      <ArrowLeft size={16} strokeWidth={2} aria-hidden className="shrink-0 transition-transform group-hover:-translate-x-0.5" />
      <span className="truncate">{children}</span>
    </Link>
  );
}
