import { getResend, FROM_EMAIL } from "./client";

export type SendInviteParams = {
  to: string;
  inviteUrl: string;
  storeName: string;
  inviterName: string | null;
  role: "owner" | "manager" | "staff";
};

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

const ROLE_LABEL: Record<SendInviteParams["role"], string> = {
  owner: "co-owner",
  manager: "manager",
  staff: "team member",
};

/**
 * Sends an invitation email via Resend.
 * Returns silently if no Resend API key is configured (so the invite still
 * gets created — they can fall back to copying the link manually).
 */
export async function sendInviteEmail(p: SendInviteParams): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const inviter = p.inviterName ?? "Your store";
  const subject = `${inviter} invited you to join ${p.storeName} on BevTek`;
  const html = renderInviteHtml(p);
  const text = renderInviteText(p);

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [p.to],
      subject,
      html,
      text,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id ?? null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function renderInviteHtml(p: SendInviteParams): string {
  const inviter = p.inviterName ?? "Your store";
  const roleLabel = ROLE_LABEL[p.role];
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#FBF7F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:600px;margin:0 auto;padding:32px 16px;">
      <tr>
        <td style="background:#ffffff;border-radius:12px;padding:40px 32px;border:1px solid #E5E7EB;">
          <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6B7280;margin:0 0 24px 0;">
            BevTek<span style="color:#C8984E;">.ai</span>
          </p>
          <h1 style="font-size:24px;font-weight:600;letter-spacing:-0.01em;line-height:1.2;margin:0 0 16px 0;">
            You&rsquo;re invited to join <span style="color:#C8984E;">${escapeHtml(p.storeName)}</span>.
          </h1>
          <p style="font-size:16px;line-height:1.6;color:#374151;margin:0 0 24px 0;">
            ${escapeHtml(inviter)} added you as a <strong>${roleLabel}</strong> on BevTek &mdash; the AI platform their store uses for staff training, customer questions, and inventory.
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="background:#C8984E;border-radius:6px;">
                <a href="${escapeAttr(p.inviteUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                  Accept invitation
                </a>
              </td>
            </tr>
          </table>
          <p style="font-size:12px;color:#6B7280;margin:24px 0 0 0;line-height:1.5;">
            Or paste this link into your browser:<br>
            <span style="font-family:monospace;color:#374151;word-break:break-all;">${escapeHtml(p.inviteUrl)}</span>
          </p>
          <hr style="border:none;border-top:1px solid #E5E7EB;margin:32px 0;">
          <p style="font-size:12px;color:#6B7280;margin:0;line-height:1.5;">
            This invitation expires in 14 days. If you weren&rsquo;t expecting it, just ignore this email &mdash; nothing happens until you click the link.
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
}

function renderInviteText(p: SendInviteParams): string {
  const inviter = p.inviterName ?? "Your store";
  const roleLabel = ROLE_LABEL[p.role];
  return [
    `${inviter} invited you to join ${p.storeName} on BevTek as a ${roleLabel}.`,
    "",
    `Accept the invitation: ${p.inviteUrl}`,
    "",
    "This invitation expires in 14 days.",
    "",
    "BevTek.ai — Made for beverage retail",
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/`/g, "&#96;");
}
