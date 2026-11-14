import type { ReactNode } from "react";
import AppNav from "@/components/AppNav";
import { demoSetup } from "@/mocks/day";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppNav studentName={demoSetup.name} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-8">{children}</main>
    </>
  );
}
