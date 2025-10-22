/* eslint-disable @typescript-eslint/no-explicit-any */
// components/settings/account-content.tsx
"use client";

import * as React from "react";
// import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, Info, Clock, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";

// date-fns v4 + official time zones support
import { addDays, getDay, set, format } from "date-fns";
import { TZDate } from "@date-fns/tz";

const DEFAULT_CATS = ["cs.AI", "cs.LG", "cs.CL", "cs.CV", "cs.NE", "stat.ML"] as const;
type ViewTab = "today" | "week" | "for-you";
type ExplainerLevel = "eli5" | "student" | "expert";
type Density = "comfortable" | "compact";
type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

const AccountSchema = z.object({
  displayName: z.string().min(2, "Too short").max(64, "Too long"),
  email: z.string().email().optional(),
  categories: z
    .array(z.string())
    .refine((arr) => arr.length > 0, "Select at least one category")
    .refine((arr) => arr.every((c) => DEFAULT_CATS.includes(c as any)), "Invalid category"),
  defaultView: z.enum(["today", "week", "for-you"]),
  explainerLevel: z.enum(["eli5", "student", "expert"]),
  digestEnabled: z.boolean(),
  digestDay: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
  digestTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM").optional(),
  density: z.enum(["comfortable", "compact"]),
});
type AccountForm = z.infer<typeof AccountSchema>;

const LS_KEY = "ronbun:account-settings";

// Day mapping to JS getDay() values (0=Sun..6=Sat)
const DAY_TO_INDEX: Record<Day, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function parseHHMM(hhmm: string | undefined): { hours: number; minutes: number } {
  if (!hhmm) return { hours: 9, minutes: 0 };
  const [h, m] = hhmm.split(":");
  const hours = Math.max(0, Math.min(23, Number(h)));
  const minutes = Math.max(0, Math.min(59, Number(m)));
  return { hours, minutes };
}

// Compute next local send in a specific IANA time zone using date-fns v4 TZDate
function computeNextSend(
  day: Day,
  hhmm: string | undefined,
  tzId: string
): {
  local: TZDate;
  utc: TZDate; // TZDate in UTC zone
} {
  // “Now” in the user’s time zone
  const now = new TZDate(Date.now(), tzId);
  const { hours, minutes } = parseHHMM(hhmm);
  const targetDow = DAY_TO_INDEX[day];

  // Today at HH:MM in tzId
  const todayAt = set(now, { hours, minutes, seconds: 0, milliseconds: 0 }) as TZDate;
  const nowDow = getDay(now);

  let candidate = todayAt;
  if (nowDow === targetDow) {
    // If today is the target day, pick today if time is in future, else next week
    candidate = (todayAt > now ? todayAt : (addDays(todayAt, 7) as TZDate)) as TZDate;
  } else {
    // Days until next target day of week (strictly in future)
    const diff = (targetDow - nowDow + 7) % 7;
    const daysToAdd = diff === 0 ? 7 : diff;
    candidate = set(addDays(now, daysToAdd), {
      hours,
      minutes,
      seconds: 0,
      milliseconds: 0,
    }) as TZDate;
  }

  // Reflect the same instant as UTC TZDate
  const utc = candidate.withTimeZone("UTC");
  return { local: candidate, utc };
}

export default function AccountSettingsContent() {
//   const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const { user, isLoading: authLoading, signOut } = useAuth();

  const systemTz =
    (typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
  const [tz, setTz] = React.useState<string>(systemTz);

  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(true);
  const [saveBusy, setSaveBusy] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const form = useForm<AccountForm>({
    resolver: zodResolver(AccountSchema),
    mode: "onChange",
    defaultValues: {
      displayName: "Loading…",
      email: "",
      categories: [...DEFAULT_CATS],
      defaultView: "today",
      explainerLevel: "student",
      digestEnabled: true,
      digestDay: "Fri",
      digestTime: "09:00",
      density: "comfortable",
    },
  });

  const applyProfileToForm = React.useCallback(
    (
      profile: { display_name?: string | null; preferences?: Record<string, any> | null } | null,
      email?: string | null
    ) => {
      const prefs = (profile?.preferences as Record<string, any>) ?? {};
      setTz(typeof prefs.timezone === "string" && prefs.timezone ? prefs.timezone : systemTz);
      form.reset({
        displayName:
          (profile?.display_name?.trim?.() as string) ||
          prefs.displayName ||
          (email ? email.split("@")[0] : "User"),
        email: email ?? "",
        categories: Array.isArray(prefs.categories) && prefs.categories.length > 0 ? prefs.categories : [...DEFAULT_CATS],
        defaultView: (prefs.defaultView as ViewTab) || "today",
        explainerLevel: (prefs.explainerLevel as ExplainerLevel) || "student",
        digestEnabled: typeof prefs.digestEnabled === "boolean" ? prefs.digestEnabled : true,
        digestDay: (prefs.digestDay as Day) || "Fri",
        digestTime: typeof prefs.digestTime === "string" ? prefs.digestTime : "09:00",
        density: (prefs.density as Density) || "comfortable",
      });
    },
    [form, systemTz]
  );

  // Load profile + email
  React.useEffect(() => {
    let canceled = false;

    async function load() {
      if (!supabase) {
        try {
          const raw = localStorage.getItem(LS_KEY);
          if (raw) {
            const data = JSON.parse(raw);
            if (data && typeof data === "object" && Array.isArray(data.categories)) {
              form.reset({ ...form.getValues(), ...data });
            }
          }
        } catch {}
        setProfileLoading(false);
        return;
      }

      try {
        setProfileLoading(true);
        setLoadError(null);

        const { data: sData } = await supabase.auth.getSession();
        const email = sData?.session?.user?.email ?? null;
        const uid = sData?.session?.user?.id ?? null;

        if (!uid) {
          applyProfileToForm(null, email);
          setProfileLoading(false);
          return;
        }

        const { data: prof, error } = await supabase
          .from("profiles")
          .select("display_name,preferences")
          .eq("id", uid)
          .maybeSingle();

        if (error) {
          const raw = localStorage.getItem(LS_KEY);
          if (raw) {
            try {
              const data = JSON.parse(raw);
              if (data && typeof data === "object") {
                form.reset({ ...form.getValues(), ...data, email: email ?? "" });
                setProfileLoading(false);
                return;
              }
            } catch {}
          }
          setLoadError(error.message);
          applyProfileToForm(null, email);
          setProfileLoading(false);
          return;
        }

        applyProfileToForm(prof ?? null, email);
      } catch (e: any) {
        setLoadError(e?.message || "Failed to load profile.");
      } finally {
        if (!canceled) setProfileLoading(false);
      }
    }

    if (!authLoading) load();
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, authLoading, applyProfileToForm]);

  const onSubmit = async (values: AccountForm) => {
    setSaveBusy(true);
    try {
      // Persist locally (dev-friendly)
      try {
        localStorage.setItem(
          LS_KEY,
          JSON.stringify({ ...values, timezone: tz })
        );
      } catch {}

      // Persist to Supabase (RLS-friendly)
      if (supabase) {
        const { data: sData } = await supabase.auth.getSession();
        const uid = sData?.session?.user?.id ?? null;
        if (uid) {
          const payload = {
            id: uid,
            display_name: values.displayName,
            preferences: {
              categories: values.categories,
              defaultView: values.defaultView,
              explainerLevel: values.explainerLevel,
              digestEnabled: values.digestEnabled,
              digestDay: values.digestDay,
              digestTime: values.digestTime,
              density: values.density,
              timezone: tz,
            },
          };
          const { error } = await supabase
            .from("profiles")
            .upsert(payload, { onConflict: "id" });
          if (error) throw new Error(error.message);
        }
      }

      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2000);
    } catch (e: any) {
      alert(e?.message || "Failed to save settings.");
    } finally {
      setSaveBusy(false);
    }
  };

  const catsRaw = form.watch("categories") as string[] | undefined;
  const cats = React.useMemo(() => catsRaw ?? [], [catsRaw]);
  const digestEnabled = form.watch("digestEnabled");
  const digestDay = form.watch("digestDay") as Day;
  const digestTime = form.watch("digestTime") || "09:00";

  // Compute next send (local + UTC) using TZDate
  const next = React.useMemo(() => {
    try {
      if (!digestEnabled) return null;
      return computeNextSend(digestDay, digestTime, tz);
    } catch {
      return null;
    }
  }, [digestEnabled, digestDay, digestTime, tz]);

  // Labels
  const nextLocalLabel = next ? `${format(next.local, "EEE, MMM d • HH:mm")} (${tz})` : null;
  const nextUtcLabel = next ? format(next.utc, "EEE, MMM d • HH:mm 'UTC'") : null;

  const { isSubmitting, isValid } = form.formState;

  const handleSignOut = async () => {
    await signOut();
  };

  const signedInEmail = form.getValues("email") || user?.email || "";

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your profile, preferences, and email digests.
          </p>
          {signedInEmail ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Signed in as <span className="font-medium">{signedInEmail}</span>
            </p>
          ) : null}
          <p className="mt-0.5 text-xs text-muted-foreground">
            Timezone: <span className="font-medium">{tz}</span>
          </p>
          {loadError ? (
            <p className="mt-1 text-xs text-destructive">{loadError}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {savedAt ? (
            <span
              className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs"
              aria-live="polite"
            >
              <Check className="h-3.5 w-3.5 text-primary" />
              Saved
            </span>
          ) : null}
          <Button variant="outline" onClick={handleSignOut} disabled={authLoading}>
            Sign out
          </Button>
        </div>
      </div>

      <Separator className="mb-4 opacity-50" />

      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Left column */}
        <section className="space-y-4">
          {/* Profile */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <AvatarCircle name={form.watch("displayName") || "User"} />
              <div className="flex-1">
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="displayName">
                    Display name
                  </label>
                  <Input
                    id="displayName"
                    placeholder="Your name"
                    aria-invalid={!!form.formState.errors.displayName}
                    {...form.register("displayName")}
                    disabled={profileLoading || saveBusy}
                  />
                  {form.formState.errors.displayName ? (
                    <p className="mt-1 text-xs text-destructive">
                      {form.formState.errors.displayName.message}
                    </p>
                  ) : null}
                </div>
                <div className="mt-2">
                  <label className="text-xs text-muted-foreground" htmlFor="email">
                    Email
                  </label>
                  <Input id="email" readOnly value={signedInEmail} className="opacity-90" />
                </div>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 text-sm font-medium">Preferences</div>

            <div className="mt-3">
              <div className="text-xs text-muted-foreground">Default feed tab</div>
              <Segmented
                value={form.watch("defaultView")}
                onChange={(v) => form.setValue("defaultView", v as ViewTab, { shouldValidate: true })}
                items={[
                  { value: "today", label: "Today" },
                  { value: "week", label: "This Week" },
                  { value: "for-you", label: "For You" },
                ]}
              />
            </div>

            <div className="mt-3">
              <div className="text-xs text-muted-foreground">Explainer default level</div>
              <Segmented
                value={form.watch("explainerLevel")}
                onChange={(v) => form.setValue("explainerLevel", v as ExplainerLevel, { shouldValidate: true })}
                items={[
                  { value: "eli5", label: "ELI5" },
                  { value: "student", label: "Student" },
                  { value: "expert", label: "Expert" },
                ]}
              />
            </div>

            {/* Categories */}
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Default categories</div>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => form.setValue("categories", [...DEFAULT_CATS], { shouldValidate: true })}
                >
                  Select all
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {DEFAULT_CATS.map((c) => {
                  const checked = cats.includes(c);
                  return (
                    <label key={c} className="flex items-center gap-2 rounded-md border bg-card/80 px-2 py-1.5 text-xs">
                      <input
                        type="checkbox"
                        className="accent-[color:var(--primary)]"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked ? [...cats, c] : cats.filter((x: string) => x !== c);
                          form.setValue("categories", next, { shouldValidate: true });
                        }}
                        disabled={saveBusy}
                      />
                      <span>{c}</span>
                    </label>
                  );
                })}
              </div>
              {form.formState.errors.categories ? (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.categories.message as string}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Right column */}
        <aside className="space-y-4">
          {/* Email digests */}
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 text-sm font-medium">Email digests</div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-accent px-2 py-1 text-xs ring-1 ring-ring">
              <Info className="h-3.5 w-3.5" />
              <span>Weekly digests summarize the top papers from your watchlists.</span>
            </div>

            <label className="mt-1 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-[color:var(--primary)]"
                checked={digestEnabled}
                onChange={(e) => form.setValue("digestEnabled", e.target.checked, { shouldValidate: true })}
                disabled={saveBusy}
              />
              Enable weekly digest
            </label>

            <div className={`mt-3 grid gap-3 ${digestEnabled ? "" : "opacity-50"}`}>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Day of week</div>
                <DayPicker
                  value={digestDay as Day}
                  onChange={(d) => form.setValue("digestDay", d, { shouldValidate: true })}
                  disabled={!digestEnabled || saveBusy}
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Time</div>
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    step={60}
                    value={digestTime}
                    onChange={(e) => form.setValue("digestTime", e.target.value, { shouldValidate: true })}
                    disabled={!digestEnabled || saveBusy}
                    className="max-w-[140px]"
                  />
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {tz}
                  </span>
                </div>
                {next ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Next send: <span className="font-medium">{nextLocalLabel}</span> • {nextUtcLabel}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Account meta */}
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 text-sm font-medium">Account meta</div>
            <div className="space-y-2 text-sm">
              <MetaLine label="Status" value={<Badge variant="secondary">Active</Badge>} />
              <MetaLine label="Plan" value="Free (MVP)" />
              <MetaLine
                label="Categories"
                value={
                  <div className="flex flex-wrap gap-1">
                    {cats.map((c) => (
                      <Badge key={c} variant="outline" className="px-1.5 py-0.5 text-[10px]">
                        {c}
                      </Badge>
                    ))}
                  </div>
                }
              />
            </div>
          </div>

          {/* Danger zone */}
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 text-sm font-medium text-destructive">Danger zone</div>
            <p className="text-xs text-muted-foreground">
              This will permanently delete your account and data. This action cannot be undone.
            </p>
            <div className="mt-3">
              <Button
                variant="outline"
                className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
                type="button"
                onClick={() => {
                  const ok = confirm("Are you sure you want to delete your account? This cannot be undone.");
                  if (ok) {
                    alert("Account deletion is mocked in MVP.");
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete account
              </Button>
            </div>
          </div>

          {/* Save */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Save your changes</span>
              <Button
                type="submit"
                className="btn-primary"
                disabled={!isValid || isSubmitting || saveBusy || profileLoading}
              >
                Save settings
              </Button>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}

/* ========== UI bits ========== */

function AvatarCircle({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="grid h-12 w-12 place-items-center rounded-full border bg-card text-sm">
      {initials || "U"}
    </div>
  );
}

function Segmented({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (v: string) => void;
  items: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="mt-1 grid grid-cols-3 overflow-hidden rounded-md border bg-card sm:w-max">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          onClick={() => onChange(it.value)}
          className={[
            "px-3 py-1.5 text-xs transition-colors",
            value === it.value
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent",
          ].join(" ")}
          aria-pressed={value === it.value}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function DayPicker({
  value,
  onChange,
  disabled,
}: {
  value: Day;
  onChange: (v: Day) => void;
  disabled?: boolean;
}) {
  const days: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-md border bg-card">
      {days.map((d) => (
        <button
          key={d}
          type="button"
          disabled={disabled}
          onClick={() => onChange(d)}
          className={[
            "px-2 py-1.5 text-xs transition-colors",
            value === d
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent",
            disabled ? "opacity-60" : "",
          ].join(" ")}
          aria-pressed={value === d}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

function MetaLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}