import { getResend, FROM_EMAIL } from "./client";

// Unified billing-alert email sender.
//
// Two events matter today:
//   - payment_failed: a charge bounced; owner needs to update their card
//     before Stripe gives up retrying. Stripe's smart-retry kicks in a few
//     times but we link straight to the billing portal so the owner can
//     fix it before the account dunning-locks.
//   - trial_ending: Stripe fires `customer.subscription.trial_will_end`
//     three days before the 14-day trial converts to paid. If the card on
//     file is fine, no action needed — this is just a heads-up so owners
//     who want to cancel can do so before being billed.
//
// We deliberately don't send anything on payment_succeeded — Stripe's
// receipt email covers that and duplicating it just becomes noise in the
// inbox.

export type BillingAlertInput = {
  to: string;
  storeName: string;
} & (
  | {
      kind: "payment_failed";
      /** invoice.amount_due in cents. */
      amountDueCents: number | null;
      /** Stripe-hosted invoice URL the owner can pay from directly. */
      invoiceUrl: string | null;
    }
  | {
      kind: "trial_ending";
      /** ISO string of subscription.trial_end. */
      trialEnd: string | null;
    }
);

export async function sendBillingAlertEmail(
  input: BillingAlertInput,
): Promise<{ ok: boolean }> {
  const resend = getResend();
  if (!resend) return { ok: false };

  const { subject, heading, body, ctaLabel, ctaUrl } = build(input);

  const html = renderHtml({
    storeName: input.storeName,
    heading,
    body,
    ctaLabel,
    ctaUrl,
  });
  const text = renderText({
    storeName: input.storeName,
    heading,
    body,
    ctaLabel,
    ctaUrl,
  });

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [input.to],
      subject,
      html,
      text,
    });
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

// --- Copy templates --------------------------------------------------------

type RenderedCopy = {
  subject: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
};

function build(input: BillingAlertInput): RenderedCopy {
  const portalFallback = "https://bevtek-web.vercel.app/billing";
  if (input.kind === "payment_failed") {
    const dollars =
      input.amountDueCents != null
        ? `$${(input.amountDueCents / 100).toFixed(2)}`
        : "your latest charge";
    return {
      subject: `Payment failed — ${input.storeName}`,
      heading: "We couldn't process your latest payment",
      body: `Your bank declined ${dollars} for ${input.storeName}. Stripe will retry automatically over the next few days, but updating your card now prevents any lapse in service. Megan keeps running while we retry — you won't lose data.`,
      ctaLabel: input.invoiceUrl ? "Pay invoice" : "Update payment method",
      ctaUrl: input.invoiceUrl ?? portalFallback,
    };
  }
  // trial_ending
  const when = input.trialEnd
    ? new Date(input.trialEnd).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : "in a few days";
  return {
    subject: `Your BevTek trial ends ${when}`,
    heading: "Your free trial is ending soon",
    body: `Just a heads-up — the 14-day trial for ${input.storeName} converts to a paid subscription on ${when}. No action needed if you're staying (Stripe will charge the card on file). If you'd like to cancel or switch plans before then, you can do it from the billing portal in two taps.`,
    ctaLabel: "Manage billing",
    ctaUrl: portalFallback,
  };
}

// --- Render helpers --------------------------------------------------------

function renderHtml(p: {
  storeName: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#FBF7F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <tr>
      <td style="background:#ffffff;border-radius:12px;padding:40px 32px;border:1px solid #E5E7EB;">
        <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6B7280;margin:0 0 24px 0;">
          BevTek<span style="color:#C8984E;">.ai</span>
        </p>
        <h1 style="font-size:22px;font-weight:600;line-height:1.3;margin:0 0 16px 0;">
          ${esc(p.heading)}
        </h1>
        <p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 28px 0;">
          ${esc(p.body)}
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="background:#C8984E;border-radius:6px;">
              <a href="${esc(p.ctaUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                ${esc(p.ctaLabel)}
              </a>
            </td>
          </tr>
        </table>
        <hr style="border:none;border-top:1px solid #E5E7EB;margin:32px 0;">
        <p style="font-size:12px;color:#6B7280;margin:0;line-height:1.5;">
          Questions? Reply to this email or reach us at
          <a href="mailto:activate@bevtek.ai" style="color:#C8984E;">activate@bevtek.ai</a>.
          This message was sent to the owner of record for ${esc(p.storeName)}.
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

function renderText(p: {
  storeName: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}): string {
  return [
    p.heading,
    "",
    p.body,
    "",
    `${p.ctaLabel}: ${p.ctaUrl}`,
    "",
    "Questions? Reply to this email.",
    "",
    `BevTek.ai — ${p.storeName}`,
  ].join("\n");
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
