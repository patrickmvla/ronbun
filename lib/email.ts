// lib/email.ts
// Minimal email utilities for Ronbun digests.
// - Templating: renderDigestEmail() -> { subject, html, text }
// - Sending: sendEmail() picks provider via env (RESEND or SENDGRID) or logs in dev
//
// Env:
//   EMAIL_PROVIDER=resend|sendgrid (optional; auto if API key present)
//   RESEND_API_KEY=... (optional)
//   SENDGRID_API_KEY=... (optional)
//   EMAIL_FROM="Ronbun <no-reply@your-domain>"
//   APP_URL=https://ronbun.app

export type ScoreComponents = {
  recency?: number;
  code?: number;
  stars?: number;
  watchlist?: number;
};

export type DigestItem = {
  title: string;
  arxivId: string; // base id, e.g., 2501.12345
  authors?: string[];
  categories?: string[];
  published?: string; // ISO
  quickTake?: string; // optional 1-liner
  reason?: string; // why it ranked (watchlist match, etc.)
  score?: { global?: number; components?: ScoreComponents };

  links: {
    paper: string; // in-app link, e.g., `${APP_URL}/paper/${arxivId}`
    abs: string; // https://arxiv.org/abs/...
    pdf?: string | null;
    code?: string | null;
    pwc?: string | null;
  };

  badges?: {
    code?: boolean;
    weights?: boolean;
    benchmarks?: string[];
    stars?: number | null;
  };
};

export type DigestEmailParams = {
  to: string | string[];
  userName?: string | null;
  items: DigestItem[];
  appUrl?: string; // defaults to process.env.APP_URL
  from?: string; // defaults to process.env.EMAIL_FROM or placeholder
  weekRange?: { start?: Date; end?: Date }; // optional date range for subject/header
  unsubscribeUrl?: string; // optional
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

/* ================= Render ================= */

export function renderDigestEmail({
  
  userName,
  items,
  appUrl = process.env.APP_URL || "https://example.com",
  weekRange,
  unsubscribeUrl,
}: Omit<DigestEmailParams, "from">): RenderedEmail {
  const safeItems = (items || []).slice(0, 20); // cap to 20 for readability
  const dateLabel = formatRange(weekRange?.start, weekRange?.end);
  const subject = `Your Ronbun Digest — ${safeItems.length} paper${
    safeItems.length === 1 ? "" : "s"
  }${dateLabel ? ` · ${dateLabel}` : ""}`;

  const headerIntro = `Hi${
    userName ? ` ${escapeHtml(userName)}` : ""
  }, here’s your weekly digest of papers.`;
  const viewAllUrl = `${appUrl.replace(/\/+$/, "")}/feed`;

  const html = `<!doctype html>
<html>
  <head>
    <meta name="color-scheme" content="dark light">
    <meta name="supported-color-schemes" content="dark light">
    <meta charset="utf-8">
    <title>${escapeHtml(subject)}</title>
    <style>
      /* Basic, email-safe styles with dark-friendly colors */
      body { margin:0; padding:0; background:#0b0b0b; color:#f6f6f6; -webkit-text-size-adjust:none; -ms-text-size-adjust:none; }
      table { border-collapse:collapse; }
      a { color:#ff5900; text-decoration:none; }
      .container { width:100%; padding:20px 0; }
      .wrapper { width:100%; max-width:640px; margin:0 auto; background:#141414; border:1px solid rgba(255,255,255,0.12); border-radius:8px; }
      .inner { padding:20px; }
      .header { padding:20px 20px 0 20px; }
      .title { font-size:18px; font-weight:700; margin:0 0 4px; }
      .subtitle { font-size:12px; color:#aaaaaa; margin:0 0 12px; }
      .btn { display:inline-block; padding:8px 12px; background:#ff4200; color:#ffffff !important; border-radius:6px; font-weight:600; font-size:13px; }
      .item { padding:16px; border-top:1px solid rgba(255,255,255,0.08); }
      .item:first-of-type { border-top:none; }
      .paper-title { font-size:14px; font-weight:600; margin:0 0 6px; line-height:1.3; }
      .meta { font-size:12px; color:#b7b7b7; margin:0 0 8px; }
      .quick { font-size:13px; color:#d9d9d9; margin:0 0 8px; }
      .chips { margin:8px 0 0; }
      .chip { display:inline-block; font-size:11px; color:#eaeaea; border:1px solid rgba(255,255,255,0.16); padding:4px 8px; border-radius:999px; margin:0 6px 6px 0; }
      .links a { margin-right:10px; font-size:12px; }
      .footer { padding:14px 20px 20px; font-size:12px; color:#8c8c8c; }
      .divider { height:1px; background:rgba(255,255,255,0.08); margin:12px 0; }
      .brand { font-weight:700; letter-spacing:0.2px; }
    </style>
  </head>
  <body>
    <div class="container">
      <table role="presentation" class="wrapper" align="center" cellpadding="0" cellspacing="0">
        <tr>
          <td class="header">
            <div class="title brand">Ronbun <span style="color:#aaaaaa;">(ロンブン)</span></div>
            <div class="subtitle">${escapeHtml(
              dateLabel || "Weekly digest"
            )}</div>
          </td>
        </tr>
        <tr>
          <td class="inner">
            <p style="margin:0 0 12px;">${escapeHtml(headerIntro)}</p>
            <p style="margin:0 0 16px;">
              <a href="${escapeAttr(viewAllUrl)}" class="btn">Open feed</a>
            </p>
          </td>
        </tr>
        ${safeItems.map((it) => renderItem(it, appUrl)).join("")}
        <tr>
          <td class="footer">
            <div class="divider"></div>
            <div>Sent by <span class="brand">Ronbun</span>${
              appUrl
                ? ` · <a href="${escapeAttr(appUrl)}">${escapeHtml(appUrl)}</a>`
                : ""
            }</div>
            ${
              unsubscribeUrl
                ? `<div><a href="${escapeAttr(
                    unsubscribeUrl
                  )}">Unsubscribe</a> · <a href="${escapeAttr(
                    appUrl
                  )}/settings/account">Preferences</a></div>`
                : `<div><a href="${escapeAttr(
                    appUrl
                  )}/settings/account">Preferences</a></div>`
            }
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>`;

  const text = renderTextVersion(safeItems, appUrl, headerIntro, dateLabel);
  return { subject, html, text };
}

/* ================= Send ================= */

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
};

export async function sendEmail({
  to,
  subject,
  html,
  text,
  from,
}: SendEmailParams) {
  const provider = pickProvider();
  const fromAddr =
    from || process.env.EMAIL_FROM || "Ronbun <no-reply@localhost>";
  const toList = Array.isArray(to) ? to : [to];

  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY!;
    const body = {
      from: fromAddr,
      to: toList,
      subject,
      html,
      text,
    };
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`Resend error ${res.status}: ${msg}`);
    }
    return await res.json().catch(() => ({}));
  }

  if (provider === "sendgrid") {
    const apiKey = process.env.SENDGRID_API_KEY!;
    const body = {
      personalizations: [{ to: toList.map((email) => ({ email })) }],
      from: parseFrom(fromAddr),
      subject,
      content: [
        ...(text ? [{ type: "text/plain", value: text }] : []),
        { type: "text/html", value: html },
      ],
    };
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`SendGrid error ${res.status}: ${msg}`);
    }
    return { ok: true };
  }

  // Console (dev fallback)
  console.log("[email:console] to=", toList.join(", "), "subject=", subject);
  return { ok: true, provider: "console" };
}

export async function sendDigestEmail(params: DigestEmailParams) {
  const { subject, html, text } = renderDigestEmail(params);
  return await sendEmail({
    to: params.to,
    from:
      params.from || process.env.EMAIL_FROM || "Ronbun <no-reply@localhost>",
    subject,
    html,
    text,
  });
}

/* ================= Internals ================= */

function pickProvider(): "resend" | "sendgrid" | "console" {
  const forced = (process.env.EMAIL_PROVIDER || "").toLowerCase();
  if (forced === "resend" && process.env.RESEND_API_KEY) return "resend";
  if (forced === "sendgrid" && process.env.SENDGRID_API_KEY) return "sendgrid";

  // Auto-pick if keys exist
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SENDGRID_API_KEY) return "sendgrid";
  return "console";
}

function formatRange(start?: Date, end?: Date): string | null {
  if (!start && !end) return null;
  try {
    if (start && end) {
      const s = start.toLocaleDateString(undefined, {
        month: "short",
        day: "2-digit",
      });
      const e = end.toLocaleDateString(undefined, {
        month: "short",
        day: "2-digit",
      });
      return `${s}–${e}`;
    }
    const d = (start || end)!;
    return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
  } catch {
    return null;
  }
}

function renderItem(it: DigestItem, appUrl: string): string {
  const inApp =
    it.links?.paper || `${appUrl.replace(/\/+$/, "")}/paper/${it.arxivId}`;
  const abs = it.links?.abs;
  const pdf = it.links?.pdf || `https://arxiv.org/pdf/${it.arxivId}.pdf`;
  const code = it.links?.code;
  const pwc = it.links?.pwc;

  const metaParts: string[] = [];
  if (it.categories?.length) metaParts.push(it.categories[0]!);
  if (it.published) {
    metaParts.push(formatRelative(it.published));
  }
  if (it.authors?.length) {
    metaParts.push(
      `${it.authors.slice(0, 3).join(", ")}${
        it.authors.length > 3 ? " et al." : ""
      }`
    );
  }

  const chips = renderChips(it);

  return `
<tr>
  <td class="item">
    <div class="paper-title"><a href="${escapeAttr(inApp)}">${escapeHtml(
    it.title
  )}</a></div>
    ${
      metaParts.length
        ? `<div class="meta">${escapeHtml(metaParts.join(" • "))}</div>`
        : ""
    }
    ${
      it.quickTake ? `<div class="quick">${escapeHtml(it.quickTake)}</div>` : ""
    }
    ${
      it.reason
        ? `<div class="meta">Reason: ${escapeHtml(it.reason)}</div>`
        : ""
    }
    <div class="links">
      ${abs ? `<a href="${escapeAttr(abs)}">arXiv</a>` : ""}
      ${pdf ? `<a href="${escapeAttr(pdf)}">PDF</a>` : ""}
      ${code ? `<a href="${escapeAttr(code)}">Code</a>` : ""}
      ${pwc ? `<a href="${escapeAttr(pwc)}">PwC</a>` : ""}
    </div>
    ${chips ? `<div class="chips">${chips}</div>` : ""}
  </td>
</tr>`;
}

function renderChips(it: DigestItem): string {
  const chips: string[] = [];
  if (it.badges?.code) chips.push(`<span class="chip">Code</span>`);
  if (it.badges?.weights) chips.push(`<span class="chip">Weights</span>`);
  if (it.badges?.benchmarks?.length) {
    chips.push(
      `<span class="chip">Benchmarks: ${escapeHtml(
        it.badges.benchmarks.length > 2
          ? `${it.badges.benchmarks.length}`
          : it.badges.benchmarks.join(", ")
      )}</span>`
    );
  }
  if (typeof it.badges?.stars === "number")
    chips.push(`<span class="chip">★ ${formatCount(it.badges.stars)}</span>`);
  if (it.score?.global !== undefined)
    chips.push(
      `<span class="chip">Score ${(it.score.global * 100).toFixed(0)}%</span>`
    );
  return chips.join("");
}

function renderTextVersion(
  items: DigestItem[],
  appUrl: string,
  headerIntro: string,
  dateLabel: string | null
): string {
  const lines: string[] = [];
  lines.push(`Ronbun${dateLabel ? ` — ${dateLabel}` : ""}`);
  lines.push(headerIntro);
  lines.push("");
  for (const it of items) {
    lines.push(`• ${it.title}`);
    const meta: string[] = [];
    if (it.categories?.length) meta.push(it.categories[0]!);
    if (it.published) meta.push(formatRelative(it.published));
    if (it.authors?.length)
      meta.push(
        `${it.authors.slice(0, 3).join(", ")}${
          it.authors.length > 3 ? " et al." : ""
        }`
      );
    if (meta.length) lines.push(`  ${meta.join(" • ")}`);
    if (it.reason) lines.push(`  Reason: ${it.reason}`);
    lines.push(`  Open: ${appUrl.replace(/\/+$/, "")}/paper/${it.arxivId}`);
    if (it.links?.abs) lines.push(`  arXiv: ${it.links.abs}`);
    if (it.links?.pdf) lines.push(`  PDF: ${it.links.pdf}`);
    if (it.links?.code) lines.push(`  Code: ${it.links.code}`);
    if (it.links?.pwc) lines.push(`  PwC: ${it.links.pwc}`);
    lines.push("");
  }
  lines.push(`View all: ${appUrl.replace(/\/+$/, "")}/feed`);
  return lines.join("\n");
}

/* ================= Small helpers ================= */

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = Math.max(0, now - d.getTime());
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const dd = Math.floor(h / 24);
    if (dd < 7) return `${dd}d`;
    const w = Math.floor(dd / 7);
    return `${w}w`;
  } catch {
    return "";
  }
}

function formatCount(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}

function parseFrom(from: string): { email: string; name?: string } {
  // "Name <addr@x>" or plain
  const m = from.match(/^(.*)<\s*([^>]+)\s*>$/);
  if (m) {
    return { email: m[2].trim(), name: m[1].trim().replace(/(^"|"$)/g, "") };
  }
  return { email: from.trim() };
}
