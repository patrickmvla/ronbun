// app/(app)/layout.tsx
import Navbar from "@/components/layout/navbar";
import AuthGate from "@/components/layout/auth-gate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col overflow-x-hidden">
      {/* Skip link for a11y */}
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:ring-1 focus:ring-ring"
      >
        Skip to content
      </a>

      {/* Navbar (sticky within component) */}
      <Navbar />

      {/* Main */}
      <AuthGate>
        <main
          id="content"
          className="flex-1 px-4 py-4 sm:px-6 lg:px-8 scroll-mt-16 focus:outline-none"
        >
          {children}
        </main>
      </AuthGate>
    </div>
  );
}