// app/(marketing)/layout.tsx
import { Suspense } from "react";
import Navbar from "@/components/layout/navbar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ronbun — Track AI/ML and CS papers",
  description:
    "Fast, dark-only tracker for AI/ML and CS papers with summaries, explainers, reviewer mode, and leaderboards.",
};

// Avoid SSG expectations when client hooks (useSearchParams/usePathname) are used in children
export const dynamic = "force-dynamic";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh flex flex-col overflow-x-hidden">
      <Suspense
        fallback={
          <nav className="sticky top-0 z-50 border-b backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <div className="mx-auto max-w-7xl px-3 sm:px-4">
              <div className="flex h-14 items-center gap-2">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-card" />
                <div className="ml-auto hidden md:flex min-w-[320px] max-w-md">
                  <div className="h-9 w-full rounded-md border bg-muted/30" />
                </div>
                <div className="ml-2 h-8 w-20 rounded-md border bg-muted/30" />
              </div>
            </div>
          </nav>
        }
      >
        <Navbar />
      </Suspense>

      <main className="flex-1">
        <Suspense
          fallback={
            <div className="mx-auto max-w-6xl px-4 py-16">
              <div className="h-8 w-64 rounded-md border bg-muted/30" />
              <div className="mt-4 h-24 rounded-xl border bg-card" />
            </div>
          }
        >
          {children}
        </Suspense>
      </main>
    </div>
  );
}