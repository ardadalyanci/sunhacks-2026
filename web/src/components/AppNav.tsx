"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SunnyMark from "./SunnyMark";

const LINKS = [
  { href: "/week", label: "Week" },
  { href: "/discover", label: "Discover" },
  { href: "/futures", label: "Two futures" },
];

export default function AppNav({ studentName }: { studentName: string }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-ink/10 bg-sky/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <SunnyMark size={34} />
          <span className="font-display text-2xl font-bold tracking-tight">Sunny</span>
        </Link>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-full px-4 py-2 font-bold ${
                  active ? "bg-ink text-cloud" : "hover:bg-ink/10"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <p className="ml-auto hidden text-ink-soft md:block">Planning for {studentName}</p>
      </div>
    </header>
  );
}
