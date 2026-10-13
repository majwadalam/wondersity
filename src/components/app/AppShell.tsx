"use client";

import { BarChart3, BookOpen, Bookmark, House, LogOut, Menu, Plus, Settings, X } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { TopProgressBar } from "../LoadingIndicator";
import { spring } from "../motion/presets";
import { AppStateProvider, useAppState } from "./AppState";
import { Brand, LogoMark } from "./Brand";
import { Notices } from "./Notices";
import { StartCourseDialog } from "./StartCourse";

// Three kinds of page, three frames:
//   marketing (landing, pricing, legal, sign in): a site header and footer;
//   the app (home, courses, progress, library, settings): a sidebar;
//   focus (a lesson, onboarding): the page alone, full screen.

const NAV = [
  { href: "/home", label: "Home", Icon: House },
  { href: "/courses", label: "Courses", Icon: BookOpen },
  { href: "/progress", label: "Progress", Icon: BarChart3 },
  { href: "/library", label: "Library", Icon: Bookmark },
];

const APP_PREFIXES = ["/home", "/courses", "/progress", "/library", "/settings"];
const isAppPage = (pathname: string) => APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
/** A lesson (/courses/:id/:n) or onboarding: nothing around the page. */
const isFocusPage = (pathname: string) => /^\/courses\/[^/]+\/[^/]+\/?$/.test(pathname) || pathname.startsWith("/welcome");
const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** True once the page has scrolled past the top. */
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return scrolled;
}

export function Avatar({ size = 32 }: { size?: number }) {
  const { profile } = useAppState();
  const name = profile?.displayName || profile?.email || "";
  if (profile?.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={profile.avatarUrl} alt="" width={size} height={size} className="rounded-full object-cover" referrerPolicy="no-referrer" />;
  }
  return (
    <span
      className="flex items-center justify-center rounded-full bg-gradient-to-br from-[#7a5cff] to-[#3aa0e8] font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden
    >
      {(name[0] ?? "·").toUpperCase()}
    </span>
  );
}

// ---------- marketing ----------

const SITE_LINKS = [
  ["/#how", "How it works"],
  ["/#subjects", "Subjects"],
  ["/pricing", "Pricing"],
] as const;

function MarketingHeader() {
  const { signedIn } = useAppState();
  const scrolled = useScrolled();
  // Phones: the site links live in a menu under the bar.
  // It remembers the page it was opened on, so moving to another page closes it.
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const menu = openOn === pathname;
  const setMenu = (open: boolean) => setOpenOn(open ? pathname : null);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    // The page stays still under the open menu.
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = before;
    };
  }, [menu]);
  // Every marketing page has a light header (only the landing footer is dark).
  const dark = false;
  // Always a solid bar; the hairline appears once the page moves under it.
  return (
    <header
      className={`sticky top-0 z-30 border-b transition-colors duration-200 ${
        dark
          ? `bg-navy ${scrolled ? "border-white/10" : "border-transparent"}`
          : `app-header ${scrolled ? "border-line" : "border-transparent"}`
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Brand light={dark} />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Site">
          {SITE_LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-2 text-[15px] font-medium ${dark ? "text-white/70 hover:text-white" : "text-fg/75 hover:text-fg"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {signedIn ? (
            <Link href="/home" className={`${dark ? "btn-glow" : "btn-pill btn-pill-dark"} px-4 py-2 text-sm`}>
              Open Wondersity
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className={`hidden rounded-full px-3.5 py-2 text-sm font-medium min-[400px]:inline-flex ${dark ? "text-white/75 hover:text-white" : "text-fg/80 hover:text-fg"}`}
              >
                Sign in
              </Link>
              <Link href="/login?mode=signup" className={`${dark ? "btn-glow" : "btn-pill btn-pill-dark"} px-4 py-2 text-sm`}>
                Get started
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setMenu(!menu)}
            aria-expanded={menu}
            aria-controls="site-menu"
            aria-label={menu ? "Close menu" : "Open menu"}
            className="-mr-1 flex h-10 w-10 items-center justify-center rounded-full text-fg hover:bg-canvas md:hidden"
          >
            {menu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {/* Over the page, not in its flow: opening it doesn't push the page down. A tap outside closes it. */}
      {menu && <div className="fixed inset-x-0 top-16 bottom-0 bg-navy/25 md:hidden" aria-hidden onClick={() => setMenu(false)} />}
      {menu && (
        <nav id="site-menu" aria-label="Site" className="step-sheet absolute inset-x-0 top-full border-t border-line bg-white px-4 pt-2 pb-4 shadow-[var(--shadow-md)] md:hidden">
          {[...SITE_LINKS, ...(signedIn ? [] : ([["/login", "Sign in"]] as const))].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenu(false)}
              className="block rounded-xl px-3 py-3 text-[16px] font-medium text-fg hover:bg-canvas"
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function MarketingFooter({ dark = false }: { dark?: boolean }) {
  const cols: [string, [string, string][]][] = [
    ["Product", [["How it works", "/#how"], ["Subjects", "/#subjects"], ["Pricing", "/pricing"]]],
    ["Account", [["Sign in", "/login"], ["Create an account", "/login?mode=signup"]]],
    ["Legal", [["Privacy", "/privacy"], ["Terms", "/terms"]]],
  ];
  return (
    <footer className={dark ? "border-t border-white/10 bg-navy" : "border-t border-line bg-white"}>
      <div className="mx-auto grid max-w-[1080px] gap-10 px-5 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Brand light={dark} />
          <p className={`mt-3 max-w-xs text-sm leading-relaxed ${dark ? "text-white/55" : "text-muted"}`}>Courses on anything, taught by doing. Named for the square where Socrates asked his questions.</p>
        </div>
        {cols.map(([title, links]) => (
          <div key={title}>
            <p className={`text-sm font-semibold ${dark ? "text-white" : "text-fg"}`}>{title}</p>
            <ul className="mt-3 space-y-2">
              {links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className={`text-sm ${dark ? "text-white/55 hover:text-white" : "text-muted hover:text-fg"}`}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div
        className={`mx-auto flex max-w-[1080px] flex-wrap justify-between gap-2 border-t px-5 py-6 text-xs ${dark ? "border-white/10 text-white/45" : "border-line text-muted"}`}
      >
        <span>© {new Date().getFullYear()} Wondersity</span>
      </div>
    </footer>
  );
}

// ---------- the app ----------

function UserMenu() {
  const { profile, signOut } = useAppState();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left hover:bg-canvas"
      >
        <Avatar size={32} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">{profile?.displayName || "Your account"}</span>
          <span className="block truncate text-xs text-muted">{profile?.email}</span>
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className="absolute bottom-full left-0 z-40 mb-2 w-full min-w-52 overflow-hidden rounded-xl border border-line bg-white p-1 shadow-[var(--shadow-lg)]"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
          >
            <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-fg hover:bg-canvas">
              <Settings size={16} className="text-muted" /> Settings
            </Link>
            <button role="menuitem" type="button" onClick={signOut} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-fg hover:bg-canvas">
              <LogOut size={16} className="text-muted" /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-white px-3 py-4 md:flex">
      <div className="px-2">
        <Link href="/home" className="flex items-center gap-2" aria-label="Wondersity home">
          <LogoMark />
          <span className="text-[20px] font-semibold tracking-[-0.03em] text-fg">wondersity</span>
        </Link>
      </div>
      <Link href="/home?new=1" className="btn-pill btn-pill-accent mt-6 justify-center gap-1.5 py-2.5 text-sm">
        <Plus size={16} strokeWidth={2.5} /> New course
      </Link>
      <nav className="mt-6 space-y-0.5" aria-label="App">
        {NAV.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[14.5px] font-medium transition-colors ${
                active ? "bg-accent-soft text-accent-strong" : "text-muted hover:bg-canvas hover:text-fg"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-1.5 border-t border-line pt-4 pb-1">
        <Link
          href="/settings"
          aria-current={isActive(pathname, "/settings") ? "page" : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[14.5px] font-medium ${
            isActive(pathname, "/settings") ? "bg-accent-soft text-accent-strong" : "text-muted hover:bg-canvas hover:text-fg"
          }`}
        >
          <Settings size={18} strokeWidth={1.8} /> Settings
        </Link>
        <UserMenu />
      </div>
    </aside>
  );
}

/** Phones: a slim top bar and tabs along the bottom. */
function PhoneBars() {
  const pathname = usePathname();
  return (
    <>
      <header className="app-header sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line px-4 md:hidden">
        <Link href="/home" className="flex items-center gap-2" aria-label="Wondersity home">
          <LogoMark size={24} />
          <span className="text-lg font-semibold tracking-[-0.03em] text-fg">wondersity</span>
        </Link>
        <Link href="/settings" aria-label="Settings">
          <Avatar size={30} />
        </Link>
      </header>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="App"
      >
        {NAV.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${active ? "text-accent" : "text-muted"}`}
            >
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

// What a run does, in order. Shown as a description, not as progress: the
// API reports nothing until the run is finished, so nothing here ticks off.
const RUN_STEPS = {
  tailored: [
    "Turns your goal into the outcomes the course builds to",
    "Plans levels of short lessons around them and your materials",
    "Opens your course, and writes lesson 1 for where you're starting",
  ],
  plan: [
    "Plans the course as levels of short lessons",
    "Opens your course as soon as the plan is ready",
    "Writes lesson 1 while you look around",
  ],
  module: [
    "Looks at how your earlier checks went",
    "Writes this lesson",
    "A second model checks it, and it's revised if it falls short",
  ],
};
const USUAL_SECONDS = 120;

function useElapsedSeconds(since: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, Math.floor((now - since) / 1000));
}

/**
 * Full-screen "tutor is working" state. Honest about what it knows: the kind
 * of run, how long it has taken, and that you can stop waiting.
 */
function BusyOverlay() {
  const { busy } = useAppState();
  // Once a new course's plan is saved, the learner is on its page, which shows lesson 1 being written.
  return <AnimatePresence>{busy && !busy.courseId && <BusyDialog key={busy.startedAt} busy={busy} />}</AnimatePresence>;
}

function BusyDialog({ busy }: { busy: NonNullable<ReturnType<typeof useAppState>["busy"]> }) {
  const { cancelLearn } = useAppState();
  const elapsed = useElapsedSeconds(busy.startedAt);
  const stopRef = useRef<HTMLButtonElement>(null);
  // Move focus into the dialog, and give it back to where it was on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    stopRef.current?.focus();
    return () => previous?.focus?.();
  }, []);
  const minutes = Math.floor(elapsed / 60);
  const clock = `${minutes}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-fg/30 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="busy-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      onKeyDown={(e) => {
        if (e.key === "Escape") cancelLearn();
      }}
    >
      <motion.div
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-7 shadow-2xl"
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: spring.gentle }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
      >
        <div className="flex items-center gap-3">
          {/* The logo on a soft tile that gently breathes while the tutor works (still with reduced motion). */}
          <motion.span
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-accent-soft"
            animate={{ scale: [1, 1.06, 1], opacity: [1, 0.85, 1] }}
            transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
            aria-hidden
          >
            <LogoMark size={24} />
          </motion.span>
          <p id="busy-title" className="font-display text-xl leading-snug text-fg">
            {busy.label}
          </p>
        </div>
        <p className="mt-3 text-sm text-muted">
          {busy.kind === "plan" ? "Your tutor is planning it. This usually takes under a minute." : "Your tutor is writing it. This usually takes one to two minutes."}
        </p>
        <ol className="mt-5 space-y-2.5 text-sm text-fg">
          {RUN_STEPS[busy.tailored ? "tailored" : busy.kind].map((step, i) => (
            <motion.li
              key={step}
              className="flex gap-3"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0, transition: { delay: 0.15 + i * 0.08, ...spring.gentle } }}
            >
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
                {i + 1}
              </span>
              {step}
            </motion.li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-xs text-muted" aria-live="off">
            <span className="font-mono tabular-nums text-fg">{clock}</span>
            {elapsed > USUAL_SECONDS ? " · taking longer than usual" : " elapsed"}
          </span>
          <button ref={stopRef} type="button" onClick={cancelLearn} className="btn-secondary rounded-lg px-3.5 py-1.5 text-xs font-medium">
            Stop waiting
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Stopping only stops the wait here. Your tutor may still finish, and the lesson will be ready when you come back.
        </p>
      </motion.div>
    </motion.div>
  );
}




function Shell({ children }: { children: ReactNode }) {
  const { busy } = useAppState();
  const pathname = usePathname();
  // Notices float over the page in a fixed stack (see Notices.tsx): they never push the layout.
  const errors = <Notices />;
  if (isFocusPage(pathname)) {
    return (
      <>
        {busy && <TopProgressBar />}
        {errors}
        {children}
        <BusyOverlay />
        <StartCourseDialog />
      </>
    );
  }
  if (isAppPage(pathname)) {
    return (
      <>
        {busy && <TopProgressBar />}
        <Sidebar />
        <PhoneBars />
        <div className="min-h-screen bg-canvas pb-20 md:pb-0 md:pl-60">
          {errors}
          {children}
        </div>
        <BusyOverlay />
        <StartCourseDialog />
      </>
    );
  }
  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />
      {errors}
      {children}
      <BusyOverlay />
      <StartCourseDialog />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    // reducedMotion="user": with the OS setting on, Motion drops transform and
    // layout animation app-wide (opacity still fades); CSS has its own rule.
    <MotionConfig reducedMotion="user">
      <AppStateProvider>
        <Shell>{children}</Shell>
      </AppStateProvider>
    </MotionConfig>
  );
}
