import { getResend, FROM_EMAIL } from "./client";

export async function sendWelcomeEmail(p: {
  to: string;
  storeName: string;
  ownerName: string | null;
  dashboardUrl: string;
  shopperUrl: string | null;
}): Promise<{ ok: boolean }> {
  const resend = getResend();
  if (!resend) return { ok: false };

  const name = p.ownerName ?? "there";
  const subject = `Welcome to BevTek — ${p.storeName} is live`;

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#FBF7F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <tr>
      <td style="background:#ffffff;border-radius:12px;padding:40px 32px;border:1px solid #E5E7EB;">
        <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6B7280;margin:0 0 24px 0;">
          BevTek<span style="color:#C8984E;">.ai</span>
        </p>
        <h1 style="font-size:24px;font-weight:600;line-height:1.2;margin:0 0 16px 0;">
          Welcome, ${esc(name)}. <span style="color:#C8984E;">${esc(p.storeName)}</span> is live.
        </h1>
        <p style="font-size:16px;line-height:1.6;color:#374151;margin:0 0 24px 0;">
          Megan is standing by. Here&rsquo;s what to do next:
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px 0;">
          <tr><td style="padding:6px 0;font-size:14px;color:#374151;"><strong>1.</strong> Import your inventory from any spreadsheet</td></tr>
          <tr><td style="padding:6px 0;font-size:14px;color:#374151;"><strong>2.</strong> Upload your store logo in Settings</td></tr>
          <tr><td style="padding:6px 0;font-size:14px;color:#374151;"><strong>3.</strong> Invite your team — they get the Trainer + Assistant</td></tr>
          <tr><td style="padding:6px 0;font-size:14px;color:#374151;"><strong>4.</strong> Email <a href="mailto:activate@bevtek.ai" style="color:#C8984E;">activate@bevtek.ai</a> to enable voice + texting</td></tr>
        </table>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px 0;">
          <tr>
            <td style="background:#C8984E;border-radius:6px;">
              <a href="${esc(p.dashboardUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                Open your dashboard
              </a>
            </td>
          </tr>
        </table>
        ${p.shopperUrl ? `<p style="font-size:12px;color:#6B7280;margin:16px 0 0 0;">Your customer storefront: <a href="${esc(p.shopperUrl)}" style="color:#C8984E;font-family:monospace;">${esc(p.shopperUrl.replace(/^https?:\/\//, ""))}</a></p>` : ""}
        <hr style="border:none;border-top:1px solid #E5E7EB;margin:32px 0;">
        <p style="font-size:12px;color:#6B7280;margin:0;line-height:1.5;">
          Questions? Reply to this email or reach us at activate@bevtek.ai. We typically respond within a few hours.
        </p>
      </td>
    </tr>
    <tr>
      <td style="text-align:center;padding-top:16px;font-size:11px;color:#9CA3AF;">
        BevTek.ai &middot; Made for beverage retail
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Welcome to BevTek, ${name}! ${p.storeName} is live.`,
    "",
    "What to do next:",
    "1. Import your inventory from any spreadsheet",
    "2. Upload your store logo in Settings",
    "3. Invite your team",
    "4. Email activate@bevtek.ai to enable voice + texting",
    "",
    `Dashboard: ${p.dashboardUrl}`,
    p.shopperUrl ? `Customer storefront: ${p.shopperUrl}` : "",
    "",
    "Questions? Reply to this email.",
    "",
    "BevTek.ai — Made for beverage retail",
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
