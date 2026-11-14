import type { ReactNode } from "react";
import AppNav from "@/components/AppNav";
import { demoStudent } from "@/mocks/demo";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppNav studentName={demoStudent.name} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-8">{children}</main>
    </>
  );
}
