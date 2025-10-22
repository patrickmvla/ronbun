/* eslint-disable @typescript-eslint/no-explicit-any */
// app/auth/callback/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  LayoutGrid,
  ShieldCheck,
  Mail,
  Github,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

type StepStatus = "pending" | "active" | "done" | "skip";
type Phase = "validate" | "exchange" | "persist" | "redirect" | "error";

function sanitizeNext(next: string, origin: string) {
  try {
    const u = new URL(next, origin);
    if (u.origin === origin) {
      return (u.pathname || "/feed") + (u.search || "") + (u.hash || "");
    }
  } catch {}
  return "/feed";
}

function Step({
  label,
  status,
  hint,
  icon,
}: {
  label: string;
  status: StepStatus;
  hint?: string;
  icon?: "mail" | "github" | "shield";
}) {
  const Icon =
    status === "done"
      ? CheckCircle2
      : status === "active"
      ? Loader2
      : status === "skip"
      ? ShieldCheck
      : Loader2;

  const AccentIcon =
    icon === "mail" ? Mail : icon === "github" ? Github : ShieldCheck;

  const base =
    status === "done"
      ? "text-primary"
      : status === "active"
      ? "text-muted-foreground"
      : status === "skip"
      ? "text-muted-foreground/80"
      : "text-muted-foreground/80";

  const spin = status === "active";

  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <div className="mt-0.5">
        <Icon
          className={["h-4 w-4", base, spin ? "animate-spin" : ""].join(" ")}
        />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {icon ? <AccentIcon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
        </div>
        {hint ? (
          <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
        ) : null}
      </div>
    </div>
  );
}

function CallbackInner() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  const rawNext = params?.get("next") || "/feed";
  const next = useMemo(() => sanitizeNext(rawNext, origin), [rawNext, origin]);

  const urlError = params?.get("error") || params?.get("error_description");
  const hasAuthCode = !!params?.get("code"); // OAuth/SSO (PKCE)
  const [phase, setPhase] = useState<Phase>("validate");
  const [detail, setDetail] = useState<string | null>(urlError || null);
  const [countdown, setCountdown] = useState(2);
  const ranRef = useRef(false);

  // Derive step states from phase + hasAuthCode
  const steps = useMemo(() => {
    // const map = (p: Phase, step: Phase) =>
    //   p === step ? "active" : (["redirect", "error"].includes(p) || p > step ? "done" : "pending");
    // TS doesn’t compare strings, so map manually
    const order: Record<Phase, number> = {
      validate: 0,
      exchange: 1,
      persist: 2,
      redirect: 3,
      error: 99,
    };
    const statusFor = (target: Phase): StepStatus => {
      if (phase === "error") return target === "validate" ? "done" : "pending";
      if (phase === target) return "active";
      return order[phase] > order[target] ? "done" : "pending";
    };

    return [
      { label: "Validating link", status: "done" as StepStatus, hint: "Checking callback params" },
      hasAuthCode
        ? {
            label: "Exchanging code (OAuth PKCE)",
            status: statusFor("exchange"),
            hint: "Contacting Supabase Auth",
            icon: "github" as const,
          }
        : {
            label: "Verifying magic link",
            status: "done" as StepStatus,
            hint: "Continuing with email link",
            icon: "mail" as const,
          },
      {
        label: "Setting session",
        status: statusFor("persist"),
        hint: "Saving your session securely",
        icon: "shield" as const,
      },
      {
        label: "Redirecting",
        status: statusFor("redirect"),
        hint: "Almost there…",
      },
    ];
  }, [phase, hasAuthCode]);

  useEffect(() => {
    let cancelled = false;

    async function finishSignIn() {
      try {
        // Early redirect if client missing (dev misconfig)
        if (!supabase) {
          setPhase("redirect");
          if (!cancelled) router.replace(next);
          return;
        }

        setPhase("validate");

        // OAuth/SSO: only exchange when ?code is present, and only once
        if (hasAuthCode && !ranRef.current) {
          setPhase("exchange");
          ranRef.current = true;
          try {
            await supabase.auth.exchangeCodeForSession(window.location.href);
          } catch (e: any) {
            // Non-fatal: code may be used/invalid; fall back to session check
            console.warn("exchangeCodeForSession:", e?.message || e);
          }
        }

        // Persist/confirm session for both flows (Magic Link + OAuth)
        setPhase("persist");
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data?.session) throw new Error("No active session after sign-in.");

        // Success → short countdown then redirect
        setPhase("redirect");
        let t = 2;
        setCountdown(t);
        const id = setInterval(() => {
          if (cancelled) return clearInterval(id);
          t -= 1;
          setCountdown(t);
          if (t <= 0) {
            clearInterval(id);
            router.replace(next);
          }
        }, 600);
      } catch (e: any) {
        console.warn("callback error:", e?.message || e);
        setDetail(e?.message || "Failed to complete sign-in.");
        setPhase("error");
      }
    }

    if (!urlError) finishSignIn();
    else {
      setDetail(urlError);
      setPhase("error");
    }

    return () => {
      cancelled = true;
    };
  }, [supabase, router, next, urlError, hasAuthCode]);

  const isError = phase === "error";

  return (
    <div className="mx-auto flex min-h-[70dvh] w-full max-w-xl flex-col px-4 py-12">
      {/* Brand header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-card">
            <LayoutGrid className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <div className="flex flex-col leading-tight">
            <h1 className="text-base font-semibold">
              Ronbun <span lang="ja" className="text-muted-foreground">(ロンブン)</span>
            </h1>
            <span className="text-xs text-muted-foreground">AI/ML Papers</span>
          </div>
        </div>
        <Badge variant="secondary" className="border border-primary/30 text-primary">
          auth
        </Badge>
      </div>

      {/* Headline */}
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight">
          {isError ? "We hit a snag" : "Finishing sign-in"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isError
            ? "Your link may have expired or been used already. You can try again below."
            : hasAuthCode
            ? "Completing OAuth and saving your session."
            : "Verifying your magic link and saving your session."}
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((s, i) => (
          <Step key={i} label={s.label} status={s.status} hint={s.hint} icon={s.icon as any} />
        ))}
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {isError ? (
          <>
            <Button asChild className="btn-primary gap-2">
              <Link href="/auth/sign-in">
                Back to sign-in
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={next}>Continue to app</Link>
            </Button>
          </>
        ) : (
          <>
            <Button
              className="btn-primary gap-2"
              onClick={() => router.replace(next)}
            >
              Continue now
              <ArrowRight className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              Redirecting in {Math.max(countdown, 0)}…
            </span>
          </>
        )}
      </div>

      {/* Error details (collapsible) */}
      {isError ? (
        <div className="mt-4 rounded-lg border bg-card p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <div className="flex-1">
              <div className="text-sm font-medium">Details</div>
              <p className="mt-1 text-xs text-muted-foreground break-words">
                {detail}
              </p>
              <div className="mt-2 text-xs text-muted-foreground">
                If you used a Magic Link: request a fresh link and open it in the same browser.
                For OAuth: ensure the callback URL matches your domain in Supabase Auth settings.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Footer hint */}
      <div className="mt-8 text-center text-xs text-muted-foreground">
        Powered by Supabase Auth. We never store your password.
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[70dvh] w-full max-w-xl items-center justify-center px-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}