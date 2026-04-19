import Link from "next/link";

// Customer support landing page. Required for the Apple App Store
// listing ("Support URL" field on the App Store Connect app page) —
// without a reachable support page, App Review will flag the listing.
// Also used from the footer and from the app's Profile > Help menu.

export const metadata = {
  title: "Support — BevTek.ai",
  description:
    "Get help with BevTek.ai — app issues, store questions, privacy requests.",
};

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-sm leading-relaxed text-[color:var(--color-fg)]">
      <p className="mb-2 text-xs uppercase tracking-wider text-[color:var(--color-muted)]">
        Help
      </p>
      <h1 className="mb-2 text-3xl font-semibold">Support</h1>
      <p className="mb-10 text-[color:var(--color-muted)]">
        We&rsquo;re a small team and we answer every message. Most questions
        get a reply within one business day.
      </p>

      <Section title="General help">
        <p>
          For any question about the app, your account, a store, or a
          bottle you&rsquo;re trying to find, email{" "}
          <a className="underline" href="mailto:support@bevtek.ai">
            support@bevtek.ai
          </a>
          . Include:
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>Your email (if you have a BevTek account)</li>
          <li>The store name (if your question is store-specific)</li>
          <li>A screenshot, if something looks wrong</li>
        </ul>
      </Section>

      <Section title="Retailers and store owners">
        <p>
          If you run a shop and need help with onboarding, billing, or your
          Megan/Gabby configuration, email{" "}
          <a className="underline" href="mailto:support@bevtek.ai">
            support@bevtek.ai
          </a>{" "}
          from the address on your account, or open a ticket from your
          BevTek dashboard (Support tab).
        </p>
      </Section>

      <Section title="Text messages — opting out">
        <p>
          If you&rsquo;ve been texting with a BevTek-powered store line and
          want to stop, reply <code>STOP</code> from your phone. You&rsquo;ll
          get one confirmation and no further messages. To opt back in,
          reply <code>START</code>.
        </p>
      </Section>

      <Section title="Privacy and data requests">
        <p>
          To request a copy of your data, correct it, or delete it, email{" "}
          <a className="underline" href="mailto:privacy@bevtek.ai">
            privacy@bevtek.ai
          </a>
          . See our{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>{" "}
          for the full list of rights and what we&rsquo;ll need to verify
          you.
        </p>
      </Section>

      <Section title="Security issues">
        <p>
          If you believe you&rsquo;ve found a vulnerability in BevTek,
          please email{" "}
          <a className="underline" href="mailto:security@bevtek.ai">
            security@bevtek.ai
          </a>{" "}
          with details and reproduction steps. We&rsquo;ll acknowledge
          within 48 hours.
        </p>
      </Section>

      <Section title="Responsible drinking">
        <p>
          BevTek supports responsible consumption. If you or someone you
          know needs help, contact the U.S. SAMHSA National Helpline
          (1-800-662-HELP, available 24/7) or the equivalent service in
          your country.
        </p>
      </Section>

      <div className="mt-12 border-t border-[color:var(--color-border)] pt-6 text-xs text-[color:var(--color-muted)]">
        <Link href="/" className="underline">
          Back to home
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="underline">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="underline">
          Terms
        </Link>
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
