"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import { PRODUCT } from "./brand";
import Mascot from "./Mascot";

const LINKS = [
  { href: "/today", label: "Today" },
  { href: "/events", label: "Events" },
  { href: "/setup", label: "Setup" },
];

/**
 * "Today" while already on /today but showing a later day (#2026-11-17): go back through the hash, as the day
 * picker does. Next's Link would push "/today" with pushState, which fires no hashchange, so the later day would
 * stay on screen.
 */
function backToToday(e: MouseEvent<HTMLAnchorElement>) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // a new tab or window: leave it
  e.preventDefault();
  window.location.hash = "today";
}

export default function AppNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5 sm:gap-8">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={`${PRODUCT} home`}>
          <Mascot size={32} label="" />
          <span className="hidden font-display text-xl font-bold tracking-tight sm:inline">{PRODUCT}</span>
        </Link>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                onClick={active && link.href === "/today" ? backToToday : undefined}
                className={`inline-flex min-h-10 items-center whitespace-nowrap rounded-lg px-3.5 text-[15px] font-semibold ${
                  active ? "bg-ink/[0.07] text-ink" : "text-ink-soft hover:bg-ink/[0.04] hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
