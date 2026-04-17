import { getResend, FROM_EMAIL } from "./client";

/**
 * Sent when a staff member taps "Cannot Fulfill" on a pending hold —
 * the customer shouldn't be left waiting. Copy leans apologetic but
 * short; we surface the reason verbatim if staff typed one, falling
 * back to a generic phrase otherwise.
 */
export async function sendHoldCannotFulfillEmail(p: {
  to: string;
  customerName: string;
  storeName: string;
  itemName: string;
  itemBrand: string | null;
  reason: string;
  storePhone: string | null;
  shopperUrl: string | null;
}): Promise<{ ok: boolean }> {
  const resend = getResend();
  if (!resend) return { ok: false };

  const subject = `Update on your hold — ${p.itemName} at ${p.storeName}`;

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#FBF7F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <tr>
      <td style="background:#ffffff;border-radius:12px;padding:40px 32px;border:1px solid #E5E7EB;">
        <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6B7280;margin:0 0 24px 0;">
          ${esc(p.storeName)}
        </p>
        <h1 style="font-size:22px;font-weight:600;line-height:1.3;margin:0 0 16px 0;">
          Sorry, ${esc(p.customerName)} — we couldn&rsquo;t get this one.
        </h1>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background:#FBF7F0;border-radius:8px;padding:20px;margin:0 0 24px 0;width:100%;">
          <tr>
            <td style="font-size:14px;line-height:1.6;color:#374151;">
              ${p.itemBrand ? `<span style="color:#6B7280;">${esc(p.itemBrand)} &middot;</span> ` : ""}
              <strong>${esc(p.itemName)}</strong>
            </td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6B7280;padding-top:8px;">
              ${esc(p.reason)}
            </td>
          </tr>
        </table>
        <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 24px 0;">
          We didn&rsquo;t want to leave you waiting. If you&rsquo;d like a similar pick, ask Gabby again or give us a call — we&rsquo;ll happily find something close.
        </p>
        ${p.storePhone ? `<p style="font-size:14px;color:#374151;margin:0 0 24px 0;">Call us: <a href="tel:${esc(p.storePhone)}" style="color:#C8984E;font-weight:600;">${esc(p.storePhone)}</a></p>` : ""}
        ${p.shopperUrl ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="background:#C8984E;border-radius:6px;"><a href="${esc(p.shopperUrl)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Browse similar</a></td></tr></table>` : ""}
        <hr style="border:none;border-top:1px solid #E5E7EB;margin:32px 0;">
        <p style="font-size:11px;color:#9CA3AF;margin:0;">
          Powered by <span style="color:#C8984E;">Gabby</span> &middot; BevTek.ai
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Sorry, ${p.customerName} — we couldn't get this one.`,
    "",
    `${p.itemBrand ? `${p.itemBrand} · ` : ""}${p.itemName}`,
    p.reason,
    "",
    "We didn't want to leave you waiting. Ask Gabby again or give us a call and we'll find something close.",
    p.storePhone ? `Call: ${p.storePhone}` : "",
    "",
    `${p.storeName} · Powered by BevTek.ai`,
  ].join("\n");

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [p.to],
      subject,
      html,
      text,
    });
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
