/* eslint-disable @typescript-eslint/no-explicit-any */
// app/auth/sign-in/page.tsx
"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, Github, ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Step = "form" | "sent";

function SignInContent() {
  const supabase = React.useMemo<SupabaseClient | null>(() => createSupabaseClient(), []);
  const search = useSearchParams();
  const next = search?.get("next") || "/feed";

  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [step, setStep] = React.useState<Step>("form");
  const [error, setError] = React.useState<string>("");

  const getCallbackUrl = React.useCallback(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : process.env.APP_URL || "http://localhost:3000";
    return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  }, [next]);

  const onMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!supabase) {
      setError("Auth is not configured.");
      return;
    }
    const emailTrim = email.trim();
    if (!emailTrim) {
      setError("Please enter a valid email.");
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({
        email: emailTrim,
        options: { emailRedirectTo: getCallbackUrl() },
      });
      if (error) throw error;
      setStep("sent");
    } catch (err: any) {
      setError(err?.message || "Failed to send magic link.");
    } finally {
      setLoading(false);
    }
  };

  const onOAuth = async (provider: "github" | "google") => {
    setError("");
    if (!supabase) {
      setError("Auth is not configured.");
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: getCallbackUrl() },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err?.message || "OAuth sign-in failed.");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-10 sm:py-16">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="h-8 px-2">
          <Link href="/">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <Card className="border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Sign in to Ronbun</CardTitle>
        </CardHeader>
        <CardContent>
          {step === "form" ? (
            <>
              <form onSubmit={onMagicLink} className="space-y-3">
                <div>
                  <label htmlFor="email" className="mb-1 block text-xs text-muted-foreground">
                    Email (magic link)
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    autoComplete="email"
                    required
                  />
                </div>

                {error ? (
                  <p className="text-xs text-destructive">{error}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    We’ll email you a secure sign-in link. No password required.
                  </p>
                )}

                <Button type="submit" className="btn-primary w-full" disabled={loading || !supabase}>
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

              <div className="my-4">
                <Separator />
              </div>

              <div className="grid gap-2">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => onOAuth("github")}
                  disabled={loading || !supabase}
                >
                  <Github className="h-4 w-4" />
                  Continue with GitHub
                </Button>
                {/* Uncomment if Google is enabled in Supabase
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => onOAuth("google")}
                  disabled={loading || !supabase}
                >
                  <Chrome className="h-4 w-4" />
                  Continue with Google
                </Button>
                */}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">
                Magic link sent to <span className="font-medium">{email}</span>.
              </p>
              <p className="text-xs text-muted-foreground">
                Check your inbox. You can close this tab or go back to the app after clicking the link.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2 text-center text-xs text-muted-foreground">
          <p>
            By continuing, you agree to our{" "}
            <Link href="/legal/terms" className="text-primary hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
          <p>
            Trouble signing in?{" "}
            <Link href="/contact" className="text-primary hover:underline">
              Contact support
            </Link>
            .
          </p>
        </CardFooter>
      </Card>

      <div className="mt-4 text-center text-xs text-muted-foreground">
        <Link href={next} className="text-primary hover:underline">
          Continue without an account
        </Link>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-10 sm:py-16">
          <div className="mb-4">
            <Button asChild variant="ghost" size="sm" className="h-8 px-2" disabled>
              <span className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </span>
            </Button>
          </div>
          <Card className="border bg-card">
            <CardHeader>
              <CardTitle className="text-lg">Sign in to Ronbun</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-9 w-full rounded-md border bg-muted/30" />
                <div className="h-9 w-full rounded-md border bg-muted/30" />
                <div className="flex items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading…
                </div>
              </div>
              <div className="my-4">
                <Separator />
              </div>
              <div className="h-9 w-full rounded-md border bg-muted/30" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}