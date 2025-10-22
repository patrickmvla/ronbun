// app/(app)/settings/account/page.tsx
import { Suspense } from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import AccountSettingsContent from "@/components/settings/account-content";

export const dynamic = "force-dynamic";

export default function AccountSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Account</h1>
              <p className="mt-1 text-sm text-muted-foreground">Manage your profile, preferences, and email digests.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs">Loading…</span>
              <Button variant="outline" disabled>Sign out</Button>
            </div>
          </div>
          <Separator className="mb-4 opacity-50" />
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <section className="space-y-4">
              <div className="rounded-xl border bg-card p-4 h-32" />
              <div className="rounded-xl border bg-card p-4 h-64" />
              <div className="rounded-xl border bg-card p-4 h-40" />
            </section>
            <aside className="space-y-4">
              <div className="rounded-xl border bg-card p-4 h-40" />
              <div className="rounded-xl border bg-card p-4 h-40" />
              <div className="rounded-xl border bg-card p-4 h-28" />
              <div className="rounded-xl border bg-card p-4 h-16" />
            </aside>
          </div>
        </div>
      }
    >
      <AccountSettingsContent />
    </Suspense>
  );
}