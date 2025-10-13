import Navbar from "@/components/layout/navbar";
import type { Metadata } from "next";


export const metadata: Metadata = {
  title: "Ronbun — Track AI/ML and CS papers",
  description:
    "Fast, dark-only tracker for AI/ML and CS papers with summaries, explainers, reviewer mode, and leaderboards.",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col overflow-x-hidden">
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}