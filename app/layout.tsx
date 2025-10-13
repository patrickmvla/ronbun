// app/layout.tsx
import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/components/providers/query-provider";

const jetbrainsSans = JetBrains_Mono({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ronbun",
  description: "AI/ML and CS papers tracker with summaries, explainers, and reviewer mode.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${jetbrainsSans.variable} ${jetbrainsMono.variable} antialiased font-mono`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}