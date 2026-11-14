import type { ReactNode } from "react";
import AppNav from "@/components/AppNav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-8">{children}</main>
    </>
  );
}
