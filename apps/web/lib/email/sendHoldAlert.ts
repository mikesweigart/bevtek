import { getResend, FROM_EMAIL } from "./client";

// Alert sent to the store owner the first time we see a new hold request.
// Intentionally small and scannable — the goal is "glance your phone, see
// there's a new hold, walk over and pull it."

export async function sendHoldAlertEmail(p: {
  to: string;
  storeName: string;
  customerName: string;
  customerPhone: string | null;
  itemName: string;
  itemBrand: string | null;
  quantity: number;
  price: number | null;
  dashboardUrl: string;
}): Promise<{ ok: boolean }> {
  const resend = getResend();
  if (!resend) return { ok: false };

  const priceStr = p.price != null ? ` · $${Number(p.price).toFixed(2)}` : "";
  const subject = `New hold request — ${p.itemName} (${p.customerName})`;

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#FBF7F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <tr><td style="background:#ffffff;border-radius:12px;padding:32px;border:1px solid #E5E7EB;">
    <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#C8984E;margin:0 0 16px 0;">
      New hold · ${esc(p.storeName)}
    </p>
    <h1 style="font-size:22px;font-weight:600;line-height:1.25;margin:0 0 20px 0;">
      ${esc(p.customerName)} wants ${p.quantity > 1 ? `${p.quantity}× ` : ""}${esc(p.itemName)}.
    </h1>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background:#FBF7F0;border-radius:8px;padding:16px;margin:0 0 20px 0;width:100%;">
      <tr><td style="font-size:14px;color:#374151;line-height:1.6;">
        ${p.itemBrand ? `<span style="color:#6B7280;">${esc(p.itemBrand)} · </span>` : ""}<strong>${esc(p.itemName)}</strong>${priceStr}<br>
        ${p.customerPhone ? `Phone: <a href="tel:${esc(p.customerPhone)}" style="color:#C8984E;">${esc(p.customerPhone)}</a>` : ""}
      </td></tr>
    </table>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="background:#C8984E;border-radius:6px;">
      <a href="${esc(p.dashboardUrl)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Open holds queue</a>
    </td></tr></table>
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:28px 0 16px 0;">
    <p style="font-size:11px;color:#9CA3AF;margin:0;">
      BevTek.ai &middot; <span style="color:#C8984E;">Gabby</span> is watching the storefront for you
    </p>
  </td></tr>
</table></body></html>`;

  const text = [
    `New hold at ${p.storeName}`,
    "",
    `${p.customerName} wants ${p.quantity > 1 ? `${p.quantity}x ` : ""}${p.itemName}${priceStr}`,
    p.customerPhone ? `Phone: ${p.customerPhone}` : "",
    "",
    `Open holds queue: ${p.dashboardUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

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
