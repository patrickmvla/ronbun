import { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import SignInCard from "./sign-in-card";

export default async function AuthGate({ children }: { children: ReactNode }) {
  const supabase = await createClient();

  // If Supabase isn’t configured or URL invalid, don’t block dev UI.
  if (!supabase) {
    if (process.env.NODE_ENV !== "production") return <>{children}</>;
    return <SignInCard />;
  }

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("supabase.auth.getUser error:", error.message);
      return <>{children}</>;
    }
    return <SignInCard />;
  }

  if (!data?.user) return <SignInCard />;

  return <>{children}</>;
}