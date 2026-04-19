import Link from "next/link";

// Terms of service stub. Same caveat as /privacy: beta-grade draft
// to satisfy Stripe, Google OAuth, Apple, Sendblue, and Retell's
// "link to terms" asks. Needs a lawyer's eye before GA, especially
// the liability cap, indemnity, and alcohol-compliance sections.

export const metadata = {
  title: "Terms of Service — BevTek.ai",
  description: "The terms you agree to when you use BevTek.ai.",
};

const EFFECTIVE = "April 18, 2026";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed text-[color:var(--color-fg)]">
      <p className="mb-2 text-xs uppercase tracking-wider text-[color:var(--color-muted)]">
        Legal
      </p>
      <h1 className="mb-2 text-3xl font-semibold">Terms of Service</h1>
      <p className="mb-10 text-[color:var(--color-muted)]">
        Effective {EFFECTIVE}.
      </p>

      <Section title="Acceptance">
        <p>
          By creating a BevTek.ai account or using the service, you agree to
          these terms. If you&rsquo;re signing up on behalf of a business, you
          represent that you&rsquo;re authorized to bind that business.
        </p>
      </Section>

      <Section title="The service">
        <p>
          BevTek provides software for beverage retailers — inventory tools,
          AI assistants for staff and shoppers, a voice receptionist, texting,
          and a shopper-facing storefront. Features and limits by plan are
          described on our pricing page and may change as we improve the
          product.
        </p>
      </Section>

      <Section title="Your account">
        <ul className="ml-5 list-disc space-y-1">
          <li>Keep your credentials secret. Don&rsquo;t share logins.</li>
          <li>
            You&rsquo;re responsible for what your staff does under your store
            account.
          </li>
          <li>
            Keep your contact email current so we can reach you about billing,
            security, and service changes.
          </li>
        </ul>
      </Section>

      <Section title="Acceptable use">
        <p>You agree not to:</p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>
            Use BevTek to sell beverages to anyone under the legal drinking
            age in their jurisdiction.
          </li>
          <li>
            Configure the AI to make medical, legal, or safety claims about
            beverages.
          </li>
          <li>
            Use BevTek to send unsolicited marketing texts in violation of
            TCPA, CAN-SPAM, or your carrier&rsquo;s rules.
          </li>
          <li>
            Reverse-engineer, scrape, or attempt to extract the system prompts,
            model weights, or other customers&rsquo; data.
          </li>
          <li>
            Use BevTek to process payment card data outside of our Stripe
            integration.
          </li>
        </ul>
      </Section>

      <Section title="Your content">
        <p>
          You own the data you upload — inventory, photos, descriptions,
          customer records. You grant BevTek the rights we need to host,
          display, and process that data for you (including routing it through
          our AI subprocessor to answer shopper questions). We do not claim
          ownership, and we don&rsquo;t use your data to train general AI
          models.
        </p>
      </Section>

      <Section title="AI outputs">
        <p>
          AI responses are generated probabilistically and may be wrong.
          Don&rsquo;t rely on the AI for compliance decisions, age
          verification, dosage/medical questions, or anything where an error
          would cause real harm. You&rsquo;re responsible for reviewing what
          the AI says on your behalf — the store name on the interface is
          yours.
        </p>
      </Section>

      <Section title="Billing">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Paid plans are billed monthly in advance via Stripe. Usage-based
            add-ons (calls, texts) are billed on the following invoice.
          </li>
          <li>
            You can cancel at any time from the Billing page. Cancellation
            takes effect at the end of the current billing period; we
            don&rsquo;t prorate partial months.
          </li>
          <li>
            Failed payments trigger retries; if payment still fails, the
            account moves to a read-only state until resolved.
          </li>
        </ul>
      </Section>

      <Section title="Service level">
        <p>
          We target high availability but don&rsquo;t offer a formal uptime
          SLA during beta. We&rsquo;ll publish status and incident notes as
          the service matures.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          You can cancel any time. We may suspend or terminate accounts that
          violate these terms, put other customers at risk, or fail to pay.
          Upon termination, you can export your data for a reasonable window
          before we delete it.
        </p>
      </Section>

      <Section title="Warranty disclaimer">
        <p>
          BevTek is provided &ldquo;as is.&rdquo; To the maximum extent allowed
          by law, we disclaim implied warranties of merchantability, fitness
          for a particular purpose, and non-infringement.
        </p>
      </Section>

      <Section title="Liability cap">
        <p>
          Our aggregate liability arising out of or relating to these terms is
          limited to the amount you paid BevTek in the twelve months preceding
          the claim. We&rsquo;re not liable for indirect, incidental, or
          consequential damages, including lost profits or data.
        </p>
      </Section>

      <Section title="Indemnity">
        <p>
          You&rsquo;ll defend and indemnify BevTek against claims arising from
          your content, your use of the service in violation of these terms,
          or your violation of applicable alcohol, telecommunications, or
          privacy laws.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may update these terms. If changes are material, we&rsquo;ll
          email the retailer contact on file. Continued use after the
          effective date means you accept the new terms.
        </p>
      </Section>

      <Section title="Governing law">
        <p>
          These terms are governed by the laws of the State of Georgia, USA,
          without regard to conflict-of-law principles. Exclusive venue is in
          the state and federal courts located in Fulton County, Georgia.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms:{" "}
          <a className="underline" href="mailto:legal@bevtek.ai">
            legal@bevtek.ai
          </a>
          .
        </p>
      </Section>

      <div className="mt-12 border-t border-[color:var(--color-border)] pt-6 text-xs text-[color:var(--color-muted)]">
        <Link href="/" className="underline">
          Back to home
        </Link>{" "}
        · <Link href="/privacy" className="underline">Privacy policy</Link>
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
