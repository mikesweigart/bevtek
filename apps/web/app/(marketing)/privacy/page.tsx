import Link from "next/link";

// Privacy policy stub. This is a beta-grade draft written to satisfy
// Stripe, Google OAuth, Apple, and Sendblue's "link to a privacy
// policy" requirements before launch — NOT a substitute for legal
// review. Before we have paying customers in production, a lawyer
// needs to read this against the actual data we collect and sign off.
//
// The commitments here must stay in sync with what the product
// actually does. If we start collecting biometrics, geolocation, or
// children's data, this page changes.

export const metadata = {
  title: "Privacy Policy — BevTek.ai",
  description:
    "How BevTek.ai collects, uses, and protects data for beverage retailers and their customers.",
};

const EFFECTIVE = "April 18, 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed text-[color:var(--color-fg)]">
      <p className="mb-2 text-xs uppercase tracking-wider text-[color:var(--color-muted)]">
        Legal
      </p>
      <h1 className="mb-2 text-3xl font-semibold">Privacy Policy</h1>
      <p className="mb-10 text-[color:var(--color-muted)]">
        Effective {EFFECTIVE}.
      </p>

      <Section title="Who we are">
        <p>
          BevTek.ai (&ldquo;BevTek&rdquo;, &ldquo;we&rdquo;) provides software
          and AI tools to independent beverage retailers. Two groups interact
          with our service:
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>
            <strong>Retailers</strong> — the stores that sign up for BevTek and
            their staff.
          </li>
          <li>
            <strong>Shoppers</strong> — customers of those stores who may
            interact with AI assistants (voice, text, or chat) that BevTek
            operates on the retailer&rsquo;s behalf.
          </li>
        </ul>
      </Section>

      <Section title="What we collect from retailers">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Account data: name, email, password hash, role, store you&rsquo;re
            associated with.
          </li>
          <li>
            Business data you upload: inventory, product descriptions, tasting
            notes, photos, pricing, store profile, team roster.
          </li>
          <li>Billing data, handled by our payment processor (Stripe).</li>
          <li>
            Usage data: which features you use, API calls, error logs,
            performance telemetry.
          </li>
        </ul>
      </Section>

      <Section title="What we collect from shoppers">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Messages you send to AI assistants (voice transcripts, SMS/iMessage
            replies, chat messages).
          </li>
          <li>
            Phone number, when you text or call a store&rsquo;s BevTek-powered
            line.
          </li>
          <li>
            Consent state (opt-in / opt-out) for text messages, per carrier
            regulations.
          </li>
          <li>
            Basic analytics on the store&rsquo;s shopper-facing site (device
            type, referrer, page views) without persistent tracking.
          </li>
        </ul>
        <p className="mt-2">
          We do <strong>not</strong> sell shopper data. We do not use shopper
          conversations to train general-purpose AI models.
        </p>
      </Section>

      <Section title="How we use data">
        <ul className="ml-5 list-disc space-y-1">
          <li>To provide the features the retailer signed up for.</li>
          <li>
            To answer shopper questions about the retailer&rsquo;s inventory,
            hours, and services.
          </li>
          <li>
            To route calls and texts, log transcripts for the retailer&rsquo;s
            review, and comply with carrier consent requirements.
          </li>
          <li>To bill retailers and prevent fraud.</li>
          <li>
            To debug, improve reliability, and investigate security incidents.
          </li>
        </ul>
      </Section>

      <Section title="Subprocessors">
        <p>We rely on the following providers:</p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>Supabase — database, authentication, file storage.</li>
          <li>Vercel — application hosting and edge delivery.</li>
          <li>Anthropic — AI model inference.</li>
          <li>Retell AI — voice receptionist (call transport, transcription).</li>
          <li>Sendblue — iMessage/SMS delivery.</li>
          <li>Stripe — payments and billing.</li>
          <li>Resend — transactional email.</li>
        </ul>
        <p className="mt-2">
          Each subprocessor processes only the data it needs to deliver its
          service and is bound by its own published terms and DPA.
        </p>
      </Section>

      <Section title="Retention">
        <p>
          Retailer account data is retained for the life of the account plus a
          short post-cancellation window to support export and dispute
          resolution. Call and text transcripts are retained per the
          retailer&rsquo;s configured retention window. Shopper opt-out records
          are retained as long as carrier rules require, regardless of
          account state.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Data is encrypted in transit (TLS) and at rest. Row-level security in
          our database isolates each retailer&rsquo;s data. Service-role keys
          and webhook secrets are scoped, rotated when compromised, and never
          shipped to browsers. We run automated secret scanning on every
          change.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Retailers can export or delete their store&rsquo;s data from the
          Settings page. Shoppers who have texted a BevTek-powered store can
          reply <code>STOP</code> to opt out, or email{" "}
          <a
            className="underline"
            href="mailto:privacy@bevtek.ai"
          >
            privacy@bevtek.ai
          </a>{" "}
          to request deletion of their messages and phone number from that
          store&rsquo;s logs.
        </p>
      </Section>

      <Section title="Children">
        <p>
          BevTek sells beverage-retail software. It is not directed at
          children, and shopper-facing AI is explicitly restricted from
          recommending alcohol to anyone who appears to be underage.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If this policy changes materially, we&rsquo;ll notify retailers by
          email and update the effective date above.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Privacy questions:{" "}
          <a className="underline" href="mailto:privacy@bevtek.ai">
            privacy@bevtek.ai
          </a>
          .
        </p>
      </Section>

      <div className="mt-12 border-t border-[color:var(--color-border)] pt-6 text-xs text-[color:var(--color-muted)]">
        <Link href="/" className="underline">
          Back to home
        </Link>{" "}
        · <Link href="/terms" className="underline">Terms of service</Link>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-[color:var(--color-fg)]">{children}</div>
    </section>
  );
}
