import { getResend, FROM_EMAIL } from "./client";

export async function sendHoldConfirmationEmail(p: {
  to: string;
  customerName: string;
  storeName: string;
  itemName: string;
  itemBrand: string | null;
  price: number | null;
  quantity: number;
  holdUntil: string;
  storePhone: string | null;
  shopperUrl: string | null;
}): Promise<{ ok: boolean }> {
  const resend = getResend();
  if (!resend) return { ok: false };

  const subject = `Your hold is confirmed — ${p.itemName} at ${p.storeName}`;
  const priceStr =
    p.price != null ? `$${Number(p.price).toFixed(2)}` : "";
  const holdDate = new Date(p.holdUntil).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#FBF7F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <tr>
      <td style="background:#ffffff;border-radius:12px;padding:40px 32px;border:1px solid #E5E7EB;">
        <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6B7280;margin:0 0 24px 0;">
          ${esc(p.storeName)}
        </p>
        <h1 style="font-size:24px;font-weight:600;line-height:1.2;margin:0 0 16px 0;">
          Your hold is confirmed, ${esc(p.customerName)}.
        </h1>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background:#FBF7F0;border-radius:8px;padding:20px;margin:0 0 24px 0;width:100%;">
          <tr>
            <td style="font-size:14px;line-height:1.6;color:#374151;">
              ${p.quantity > 1 ? `<strong>${p.quantity}&times;</strong> ` : ""}
              ${p.itemBrand ? `<span style="color:#6B7280;">${esc(p.itemBrand)} &middot;</span> ` : ""}
              <strong>${esc(p.itemName)}</strong>
              ${priceStr ? ` <span style="color:#C8984E;font-weight:600;">${priceStr}</span>` : ""}
            </td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6B7280;padding-top:8px;">
              Pick up by <strong>${holdDate}</strong>
            </td>
          </tr>
        </table>
        <p style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 24px 0;">
          We&rsquo;ve set this aside for you. Just come in, give your name at the counter, and it&rsquo;s yours.
        </p>
        ${p.storePhone ? `<p style="font-size:14px;color:#374151;margin:0 0 24px 0;">Questions? Call us: <a href="tel:${esc(p.storePhone)}" style="color:#C8984E;font-weight:600;">${esc(p.storePhone)}</a></p>` : ""}
        ${p.shopperUrl ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="background:#C8984E;border-radius:6px;"><a href="${esc(p.shopperUrl)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Browse more items</a></td></tr></table>` : ""}
        <hr style="border:none;border-top:1px solid #E5E7EB;margin:32px 0;">
        <p style="font-size:11px;color:#9CA3AF;margin:0;">
          Powered by <span style="color:#C8984E;">Megan</span> &middot; BevTek.ai
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Your hold is confirmed, ${p.customerName}.`,
    "",
    `${p.quantity > 1 ? `${p.quantity}x ` : ""}${p.itemBrand ? `${p.itemBrand} · ` : ""}${p.itemName}${priceStr ? ` ${priceStr}` : ""}`,
    `Pick up by ${holdDate}`,
    "",
    "Come in, give your name at the counter, and it's yours.",
    p.storePhone ? `Questions? Call: ${p.storePhone}` : "",
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
