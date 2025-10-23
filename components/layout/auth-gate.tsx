// components/layout/auth-gate.tsx
import { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import SignInCard from "./sign-in-card";

export default async function AuthGate({ children }: { children: ReactNode }) {
  // Create SSR client (handles cookies via @supabase/ssr)
  const supabase = await createClient();

  // If Supabase isn’t configured, don’t block dev UI.
  if (!supabase) {
    if (process.env.NODE_ENV !== "production") return <>{children}</>;
    return <SignInCard />;
  }

  // Read session safely; treat any error as signed-out
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session) {
      return <SignInCard />;
    }
  } catch {
    return <SignInCard />;
  }

  // Signed in → render the protected subtree
  return <>{children}</>;
}