"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
import { Github } from "lucide-react";

export default function SignInCard() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const signInWithGithub = async () => {
    setLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: `${location.origin}/auth/callback` },
      });
    } finally {
      setLoading(false);
    }
  };

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      console.error(err);
      alert(
        "Failed to send magic link. Check the email address and try again."
      );
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
            disabled={loading}
            className="w-full gap-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] hover:bg-[color:var(--orange-4)]"
          >
            <Github className="h-4 w-4" />
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
              Check your email for a sign-in link.
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
                />
              </div>
              <Button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-secondary text-secondary-foreground hover:bg-[color:var(--accent)]"
              >
                Send magic link
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
