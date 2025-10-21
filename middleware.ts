// middleware.ts
import { NextResponse, type NextRequest } from "next/server";

export const config = {
  // Run only on API routes (adjust if you want to add headers to all routes)
  matcher: ["/api/:path*"],
};

export function middleware(req: NextRequest) {
  const { pathname, protocol } = req.nextUrl;

  // Protect cron endpoints early (in addition to server-side checks)
  if (pathname.startsWith("/api/cron/")) {
    const ok = verifyCronSecret(req);
    if (!ok) {
      return json({ error: "Unauthorized (cron)" }, 401);
    }
  }

  // Pass-through with security headers
  const res = NextResponse.next();

  // Security headers suitable for APIs
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set(
    "Permissions-Policy",
    // Restrictive defaults; expand as needed
    [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "payment=()",
      "usb=()",
    ].join(", ")
  );

  // HSTS only on HTTPS
  if (protocol === "https:") {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  return res;
}

/* ========== Helpers ========== */

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;

  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth && /^Bearer\s+/i.test(auth)) {
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (safeEq(token, secret)) return true;
  }
  const header = req.headers.get("x-cron-secret");
  if (header && safeEq(header.trim(), secret)) return true;

  return false;
}

function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(headers || {}) },
  });
}