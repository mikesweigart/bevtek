import { getResend, FROM_EMAIL } from "./client";

export type DigestData = {
  storeName: string;
  managerName: string | null;
  managerEmail: string;
  dashboardUrl: string;
  // Stats
  totalStaff: number;
  modulesCompleted: number;
  quizzesPassed: number;
  averageAccuracy: number;
  topLearner: { name: string; stars: number } | null;
  // Assistant
  totalQueries: number;
  topQueries: Array<{ query: string; count: number }>;
  // Inventory
  outOfStockCount: number;
  lowStockCount: number;
  // Holds
  pendingHolds: number;
  completedHolds: number;
};

export async function sendWeeklyDigest(data: DigestData): Promise<{ ok: boolean }> {
  const resend = getResend();
  if (!resend) return { ok: false };

  const name = data.managerName ?? "Manager";
  const subject = `Weekly Digest — ${data.storeName} · ${data.modulesCompleted} modules completed`;

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#FBF7F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <tr>
      <td style="background:#ffffff;border-radius:12px;padding:40px 32px;border:1px solid #E5E7EB;">
        <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6B7280;margin:0 0 24px 0;">
          ${esc(data.storeName)} · Weekly Digest
        </p>
        <h1 style="font-size:22px;font-weight:600;line-height:1.3;margin:0 0 8px 0;">
          Hey ${esc(name)}, here&rsquo;s this week at <span style="color:#C8984E;">${esc(data.storeName)}</span>.
        </h1>

        <!-- Training Stats -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:24px 0;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:16px;text-align:center;border-right:1px solid #E5E7EB;">
              <p style="font-size:28px;font-weight:700;margin:0;color:#C8984E;">${data.modulesCompleted}</p>
              <p style="font-size:11px;color:#6B7280;margin:4px 0 0;">Modules completed</p>
            </td>
            <td style="padding:16px;text-align:center;border-right:1px solid #E5E7EB;">
              <p style="font-size:28px;font-weight:700;margin:0;color:#C8984E;">${data.quizzesPassed}</p>
              <p style="font-size:11px;color:#6B7280;margin:4px 0 0;">Quizzes passed</p>
            </td>
            <td style="padding:16px;text-align:center;">
              <p style="font-size:28px;font-weight:700;margin:0;color:#C8984E;">${data.averageAccuracy}%</p>
              <p style="font-size:11px;color:#6B7280;margin:4px 0 0;">Avg accuracy</p>
            </td>
          </tr>
        </table>

        ${data.topLearner ? `<p style="font-size:14px;color:#374151;margin:0 0 16px;">🏆 <strong>Top learner:</strong> ${esc(data.topLearner.name)} with ${data.topLearner.stars} ⭐</p>` : ""}

        <!-- Assistant Insights -->
        ${data.totalQueries > 0 ? `
        <h2 style="font-size:14px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#6B7280;margin:24px 0 12px;">What customers asked about</h2>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;">
          ${data.topQueries.slice(0, 5).map((q) => `
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#374151;">${esc(q.query)}</td>
            <td style="padding:6px 0;font-size:14px;font-weight:600;color:#C8984E;text-align:right;">${q.count}×</td>
          </tr>`).join("")}
        </table>
        <p style="font-size:12px;color:#6B7280;margin:8px 0 0;">${data.totalQueries} total queries this week</p>
        ` : ""}

        <!-- Inventory Alerts -->
        ${(data.outOfStockCount > 0 || data.lowStockCount > 0) ? `
        <h2 style="font-size:14px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#6B7280;margin:24px 0 12px;">Inventory alerts</h2>
        ${data.outOfStockCount > 0 ? `<p style="font-size:14px;color:#dc2626;margin:0 0 4px;">⚠️ <strong>${data.outOfStockCount}</strong> items out of stock</p>` : ""}
        ${data.lowStockCount > 0 ? `<p style="font-size:14px;color:#d97706;margin:0 0 4px;">⚡ <strong>${data.lowStockCount}</strong> items low stock (≤5 units)</p>` : ""}
        ` : ""}

        <!-- Hold Requests -->
        ${(data.pendingHolds > 0 || data.completedHolds > 0) ? `
        <h2 style="font-size:14px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#6B7280;margin:24px 0 12px;">Hold requests</h2>
        <p style="font-size:14px;color:#374151;margin:0;">${data.pendingHolds} pending · ${data.completedHolds} completed this week</p>
        ` : ""}

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0;">
          <tr>
            <td style="background:#C8984E;border-radius:6px;">
              <a href="${esc(data.dashboardUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                Open dashboard
              </a>
            </td>
          </tr>
        </table>

        <hr style="border:none;border-top:1px solid #E5E7EB;margin:32px 0;">
        <p style="font-size:11px;color:#9CA3AF;margin:0;">
          Sent weekly by Megan · ${esc(data.storeName)} · BevTek.ai
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [data.managerEmail],
      subject,
      html,
    });
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
