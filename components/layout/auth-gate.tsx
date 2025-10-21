import { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import SignInCard from "./sign-in-card";

export default async function AuthGate({ children }: { children: ReactNode }) {
  const supabase = await createClient();

  // If Supabase isn’t configured, don’t block dev UI.
  if (!supabase) {
    if (process.env.NODE_ENV !== "production") return <>{children}</>;
    return <SignInCard />;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session) {
    return <SignInCard />;
  }

  return <>{children}</>;
}