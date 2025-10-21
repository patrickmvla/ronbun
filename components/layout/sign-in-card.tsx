/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Github, Loader2, Mail } from "lucide-react";

export default function SignInCard() {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const search = useSearchParams();
  const next = search?.get("next") || "/feed";

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const getCallbackUrl = () => {
    // Runs in browser (client component), safe to read window.location
    const origin = window.location?.origin;
    return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  };

  const signInWithGithub = async () => {
    setErr(null);
    if (!supabase) {
      setErr("Auth is not configured.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: getCallbackUrl() },
      });
      if (error) throw error;

      // Some environments require manual redirect
      if (data?.url) {
        window.location.href = data.url;
      }
      // Otherwise, the SDK may auto-redirect; keep spinner until navigation
    } catch (e: any) {
      setErr(e?.message || "OAuth sign-in failed.");
      setLoading(false);
    }
  };

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!supabase) {
      setErr("Auth is not configured.");
      return;
    }
    const emailTrim = email.trim();
    if (!emailTrim) {
      setErr("Please enter a valid email.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: emailTrim,
        options: { emailRedirectTo: getCallbackUrl() },
      });
      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      setErr(e?.message || "Failed to send magic link. Check the email and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[80dvh] w-full max-w-md place-items-center p-4">
      <Card className="w-full border border-[color:var(--sidebar-border)] bg-card">
        <CardHeader>
          <CardTitle className="text-xl">Sign in to Ronbun</CardTitle>
          <CardDescription>
            Track AI/ML and CS papers, watchlists, and digests.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={signInWithGithub}
            disabled={loading || !supabase}
            className="w-full gap-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] hover:bg-[color:var(--orange-4)]"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
            Continue with GitHub
          </Button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[color:var(--sidebar-border)]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {sent ? (
            <p className="text-sm text-muted-foreground">
              Magic link sent to <span className="font-medium">{email}</span>. Check your email.
            </p>
          ) : (
            <form onSubmit={sendMagicLink} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="email">Email (magic link)</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || !supabase}
                />
              </div>
              {err && <p className="text-xs text-destructive">{err}</p>}
              <Button
                type="submit"
                disabled={loading || !email || !supabase}
                className="w-full bg-secondary text-secondary-foreground hover:bg-[color:var(--accent)]"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send magic link
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}