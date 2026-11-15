"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Mascot from "@/components/Mascot";
import { clearSetup } from "@/components/setup-store";

/**
 * When Today or Events throws while rendering, the nav stays and Sol offers two ways out: render the page again,
 * or forget the saved setup (a broken one is the likeliest cause) and start from the sample day.
 */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center py-20 text-center">
      <Mascot size={128} animated mood="hot" />
      <h1 className="mt-4 max-w-md font-display text-3xl font-bold">Something broke on this page.</h1>
      <p className="mt-2 max-w-md text-lg">Try it again. If it keeps breaking, start over with a fresh setup.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-full bg-ink px-5 py-3 font-bold text-cloud hover:bg-ink/90"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => {
            clearSetup();
            // A full load on purpose: it drops the error and every in-memory cache along with the old setup.
            window.location.assign(new URL("/today", window.location.origin).href);
          }}
          className="rounded-full border-2 border-ink px-5 py-3 font-bold hover:bg-ink/10"
        >
          Start over
        </button>
      </div>
    </div>
  );
}
