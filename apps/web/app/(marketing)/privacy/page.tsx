import Link from "next/link";

// Privacy policy. Beta-grade draft written to satisfy Stripe, Google
// OAuth, Apple, Sendblue, and Retell's "link to a privacy policy"
// requirements before launch. NOT a substitute for legal review —
// a lawyer needs to read this against the actual data we collect
// before GA.
//
// The commitments here must stay in sync with what the product
// actually does. If we start collecting biometrics, geolocation, or
// children's data, this page changes.

export const metadata = {
  title: "Privacy Policy — BevTek.ai",
  description:
    "How BevTek.ai collects, uses, discloses, and protects personal data for beverage retailers and their customers.",
};

const EFFECTIVE = "April 18, 2026";
const POSTAL_ADDRESS = "3000 Old Alabama Road, Alpharetta, Georgia, USA";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed text-[color:var(--color-fg)]">
      <p className="mb-2 text-xs uppercase tracking-wider text-[color:var(--color-muted)]">
        Legal
      </p>
      <h1 className="mb-2 text-3xl font-semibold">BevTek.ai Privacy Policy</h1>
      <p className="mb-10 text-[color:var(--color-muted)]">
        Effective date: {EFFECTIVE}.
      </p>

      <p className="mb-4">
        This Privacy Policy describes how BevTek.ai, Inc.
        (&ldquo;BevTek&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
        &ldquo;our&rdquo;) collects, uses, discloses, and protects personal
        data in connection with our software and AI tools for independent
        beverage retailers (the &ldquo;Services&rdquo;).
      </p>

      <p className="mb-2">This Policy applies to:</p>
      <ul className="mb-4 ml-5 list-disc space-y-1">
        <li>
          <strong>Retailers</strong> &mdash; stores and their staff who sign
          up for BevTek and use our web or mobile applications, APIs, or
          related tools; and
        </li>
        <li>
          <strong>Shoppers</strong> &mdash; customers of those retailers who
          interact with AI assistants, phone lines, messaging channels, or
          websites that BevTek operates on the retailer&rsquo;s behalf.
        </li>
      </ul>

      <p className="mb-4">
        By using the Services or interacting with BevTek&#8209;powered
        channels, you acknowledge that you have read and understood this
        Privacy Policy.
      </p>

      <p className="mb-8 italic text-[color:var(--color-muted)]">
        Note: This Privacy Policy is not a contract and does not create any
        legal rights or obligations beyond those required by applicable law
        and any separate written agreements you have with us.
      </p>

      <Section title="1. Who we are and our role">
        <p>
          BevTek provides SaaS software and AI&#8209;powered tools to
          independent beverage retailers to help them manage inventory,
          support staff training, and assist shoppers via chat, text, and
          voice interactions.
        </p>
        <p className="mt-3">Our legal entity details:</p>
        <ul className="ml-5 mt-1 list-none space-y-0.5">
          <li>BevTek.ai, Inc.</li>
          <li>
            Contact:{" "}
            <a className="underline" href="mailto:privacy@bevtek.ai">
              privacy@bevtek.ai
            </a>
          </li>
          <li>Postal address: {POSTAL_ADDRESS}</li>
        </ul>

        <h3 className="mt-4 font-semibold">1.1. Controller vs. processor</h3>
        <p>
          Our role depends on the data and the context:
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>
            For retailer and staff data (e.g., admin accounts, usage
            telemetry, and billing data), BevTek generally acts as an
            independent &ldquo;controller&rdquo; (or &ldquo;business&rdquo;
            under California law).
          </li>
          <li>
            For shopper data that we process on behalf of a specific retailer
            (e.g., calls, text messages, chat transcripts associated with
            that store), BevTek generally acts as a &ldquo;processor&rdquo;
            or &ldquo;service provider&rdquo; to that retailer, which is the
            primary controller or business for that shopper data.
          </li>
        </ul>
        <p className="mt-2">
          If you are a shopper and have questions about how your local store
          uses your data beyond what is described here, you should also
          review that store&rsquo;s own privacy policy.
        </p>
      </Section>

      <Section title="2. Personal data we collect">
        <p>
          The categories of personal data we collect depend on whether you
          are a Retailer or a Shopper, and how you interact with our
          Services.
        </p>

        <h3 className="mt-4 font-semibold">
          2.1. Data we collect from retailers and their staff
        </h3>
        <p className="mt-2 font-medium">Account and profile data</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Name</li>
          <li>Email address</li>
          <li>Password hash (we do not store raw passwords)</li>
          <li>Role (e.g., owner, manager, staff)</li>
          <li>Store(s) you are associated with</li>
          <li>Any preferences or settings you configure in your account</li>
        </ul>
        <p className="mt-3 font-medium">Business content you provide</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Inventory data (product names, SKUs, descriptions, tasting notes,
            categorization, stock levels)
          </li>
          <li>Pricing and promotional information</li>
          <li>Store profile (store name, address, hours, branding, imagery)</li>
          <li>Team roster and internal role assignments</li>
          <li>
            Other content or metadata that you upload or configure in the
            Services
          </li>
        </ul>
        <p className="mt-3 font-medium">Billing and payment data</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Subscription plan, billing contact, and billing history</li>
          <li>
            Limited payment data (e.g., last 4 digits of card, card type,
            billing country) as returned by our payment processor
          </li>
          <li>
            We do not store full payment card numbers; these are handled by
            our payment provider (currently Stripe) pursuant to its own terms
            and privacy policy.
          </li>
        </ul>
        <p className="mt-3 font-medium">Usage, telemetry, and device data</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Log data (timestamps, IP address, browser type, OS, app version,
            referral URL)
          </li>
          <li>
            Feature usage (which modules, pages, or API endpoints are
            accessed and when)
          </li>
          <li>
            Error logs, performance metrics, and diagnostic information
          </li>
          <li>
            Approximate location (e.g., city/region) inferred from IP address
            for security and analytics
          </li>
        </ul>
        <p className="mt-3">
          We generally collect this data directly from you (when you sign up,
          configure your store, or use the dashboard and APIs) or
          automatically from your browser or device when you access the
          Services.
        </p>

        <h3 className="mt-5 font-semibold">2.2. Data we collect from shoppers</h3>
        <p>
          When shoppers interact with BevTek&#8209;powered channels (e.g.,
          Gabby on a store&rsquo;s website, SMS/iMessage, or a voice
          assistant that answers a store&rsquo;s phone line), we may collect
          and process:
        </p>
        <p className="mt-2 font-medium">Interaction content</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Messages you send to AI assistants (e.g., chat content, questions,
            feedback)
          </li>
          <li>Voice call audio, where applicable, and transcripts of those calls</li>
          <li>SMS/iMessage content and replies</li>
        </ul>
        <p className="mt-3 font-medium">Identifiers and contact details</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Phone number, when you text or call a BevTek&#8209;powered number</li>
          <li>
            Technical identifiers such as IP address and user agent (browser
            or device type)
          </li>
          <li>
            Session identifiers or other technical IDs used to associate
            interactions with a store&rsquo;s session or conversation
          </li>
        </ul>
        <p className="mt-3 font-medium">Consent and preference data</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Text messaging consent status (opt-in/opt-out) and timestamp</li>
          <li>
            Records of STOP or similar keywords used to opt out of SMS or
            iMessage communications
          </li>
          <li>
            Records of any other communication preferences you set (where
            available)
          </li>
        </ul>
        <p className="mt-3 font-medium">
          Basic analytics on shopper&#8209;facing sites
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Device type, referrer, and pages viewed on a BevTek&#8209;powered
            store website
          </li>
          <li>
            Timestamps and interaction events (e.g., opening the assistant,
            sending a message)
          </li>
          <li>
            We do not use third&#8209;party advertising cookies for
            cross&#8209;site behavioral advertising on shopper&#8209;facing
            surfaces.
          </li>
        </ul>
        <p className="mt-3">
          We generally collect this data directly from you (your messages,
          calls, and clicks) and automatically from your browser or device as
          you use the channel.
        </p>

        <h3 className="mt-5 font-semibold">
          2.3. Sensitive and special categories of data
        </h3>
        <p>
          Our Services are not designed to collect sensitive personal data
          (such as health, biometric, or financial account details) or special
          category data under GDPR. We also do not intend to collect data
          about children (see Section 10).
        </p>
        <p className="mt-2">
          If you inadvertently share sensitive data through an interaction
          (e.g., in a chat message), we will process it only as necessary to
          provide the requested service and in accordance with this Policy
          and applicable law.
        </p>
      </Section>

      <Section title="3. How we use personal data">
        <p>
          We use the personal data described above for the following
          purposes, and, where applicable, under the legal bases indicated
          for GDPR/UK GDPR.
        </p>

        <h3 className="mt-4 font-semibold">3.1. To provide and operate the Services</h3>
        <ul className="ml-5 list-disc space-y-1">
          <li>Set up and manage retailer and staff accounts</li>
          <li>Authenticate users and maintain sessions</li>
          <li>Ingest and store retailer inventory, product, and store data</li>
          <li>
            Facilitate shopper interactions with AI assistants (chat, text,
            and voice)
          </li>
          <li>Display and search inventory and store details to shoppers and staff</li>
          <li>Route, process, and log calls and messages on behalf of retailers</li>
        </ul>
        <p className="mt-2 italic text-[color:var(--color-muted)]">
          Legal bases (EEA/UK, where applicable): performance of a contract
          (Article 6(1)(b) GDPR); legitimate interests in providing and
          improving the Services (Article 6(1)(f)).
        </p>

        <h3 className="mt-4 font-semibold">3.2. To communicate with you</h3>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Send you service&#8209;related communications (e.g., account
            notices, security alerts, feature updates)
          </li>
          <li>Respond to your support requests and inquiries</li>
          <li>
            Send transactional messages (e.g., password resets, billing
            notices)
          </li>
          <li>
            For retailers who opt in, send product updates or newsletters
          </li>
        </ul>
        <p className="mt-2 italic text-[color:var(--color-muted)]">
          Legal bases: performance of a contract; legitimate interests in
          operating and growing our business; your consent, where required
          (e.g., certain marketing communications).
        </p>
        <p className="mt-2">
          You may opt out of non&#8209;essential marketing emails at any
          time via the unsubscribe link, but we may still send important
          service or security notices.
        </p>

        <h3 className="mt-4 font-semibold">
          3.3. To power AI features and improve response quality
        </h3>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Use AI model providers (currently Anthropic) to process messages
            and generate responses on behalf of retailers
          </li>
          <li>
            Provide inventory&#8209;aware recommendations, answer
            store&#8209;specific questions, and support staff training
            scenarios
          </li>
          <li>
            Analyze anonymized or aggregated interaction patterns to improve
            prompts, reliability, and user experience
          </li>
        </ul>
        <p className="mt-2">
          We configure our AI model providers so that data we send is not
          used to train their general&#8209;purpose models, to the extent
          such configuration is available under our agreements with them.
        </p>
        <p className="mt-2">
          We may create and use de&#8209;identified or aggregated data (for
          example, statistics on the types of questions asked or feature
          usage) for analytics, product improvement, and research. We do not
          attempt to re&#8209;identify individuals from this aggregated
          information.
        </p>
        <p className="mt-2 italic text-[color:var(--color-muted)]">
          Legal bases: performance of a contract (providing the AI features
          the retailer signed up for); legitimate interests in improving and
          securing our AI systems.
        </p>

        <h3 className="mt-4 font-semibold">
          3.4. To comply with messaging and carrier rules
        </h3>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Maintain required records of text messaging opt&#8209;in and
            opt&#8209;out states
          </li>
          <li>
            Honor STOP and similar keywords for all BevTek&#8209;powered
            lines
          </li>
          <li>
            Help retailers comply with carrier and telecom rules regarding
            consent, frequency, and content of messages
          </li>
        </ul>
        <p className="mt-2 italic text-[color:var(--color-muted)]">
          Legal bases: compliance with legal obligations; legitimate
          interests in maintaining lawful, reliable messaging services.
        </p>

        <h3 className="mt-4 font-semibold">3.5. To bill and prevent fraud</h3>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Process payments and manage subscriptions via our payment
            processor
          </li>
          <li>
            Track usage for billing, quota management, and enforcement of
            fair use limits
          </li>
          <li>
            Monitor and detect fraudulent or abusive activity (e.g., spam,
            misuse of AI endpoints)
          </li>
        </ul>
        <p className="mt-2 italic text-[color:var(--color-muted)]">
          Legal bases: performance of a contract; legitimate interests in
          protecting our business and customers; compliance with legal
          obligations (e.g., accounting, tax).
        </p>

        <h3 className="mt-4 font-semibold">
          3.6. To secure, maintain, and improve the Services
        </h3>
        <ul className="ml-5 list-disc space-y-1">
          <li>Monitor system performance, uptime, and reliability</li>
          <li>
            Investigate and remediate incidents, errors, and security events
          </li>
          <li>
            Run internal analytics to understand which features are used and
            where to invest product resources
          </li>
          <li>Test and roll out new features and improvements</li>
        </ul>
        <p className="mt-2 italic text-[color:var(--color-muted)]">
          Legal bases: legitimate interests in operating, securing, and
          developing our Services.
        </p>
      </Section>

      <Section title="4. Legal bases for processing (EEA/UK)">
        <p>
          Where the EU General Data Protection Regulation
          (&ldquo;GDPR&rdquo;) or UK GDPR applies, we rely on the following
          legal bases:
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>
            <strong>Performance of a contract</strong> &mdash; where
            processing is necessary to provide the Services (e.g., account
            management, AI responses, messaging).
          </li>
          <li>
            <strong>Legitimate interests</strong> &mdash; for purposes such as
            improving our Services, securing our systems, preventing fraud,
            and understanding usage patterns, provided these interests are
            not overridden by your rights and interests.
          </li>
          <li>
            <strong>Consent</strong> &mdash; for certain activities where
            required by law (e.g., some marketing communications, specific
            cookies, or optional data uses). You may withdraw consent at any
            time using the mechanisms provided or by contacting us.
          </li>
          <li>
            <strong>Compliance with legal obligations</strong> &mdash; where
            we must process data to comply with applicable laws (e.g.,
            telecom rules, accounting standards, or responding to lawful
            requests from authorities).
          </li>
        </ul>
        <p className="mt-2">
          If you have questions about a specific processing activity or its
          legal basis, you can contact us at{" "}
          <a className="underline" href="mailto:privacy@bevtek.ai">
            privacy@bevtek.ai
          </a>
          .
        </p>
      </Section>

      <Section title="5. How and when we share personal data">
        <p>
          We do not sell personal data in the traditional sense, and we do
          not use shopper data for cross&#8209;context behavioral
          advertising.
        </p>
        <p className="mt-2">
          We share personal data with the following categories of recipients,
          only as necessary for the purposes described above and subject to
          appropriate safeguards:
        </p>

        <h3 className="mt-4 font-semibold">5.1. Retailers and their staff</h3>
        <p>
          If you are a shopper, your interactions with a BevTek&#8209;powered
          assistant, phone line, or site are typically associated with a
          specific retailer. That retailer and its authorized staff may have
          access to:
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>Call transcripts and, where applicable, recordings</li>
          <li>Message content (e.g., SMS, chat) and associated metadata (timestamp, phone number)</li>
          <li>Conversation logs and analytics related to their store&rsquo;s interactions</li>
        </ul>
        <p className="mt-2">
          We provide tools for retailers to review, export, and delete this
          data in line with their compliance needs and our contractual
          obligations.
        </p>

        <h3 className="mt-4 font-semibold">
          5.2. Service providers (subprocessors)
        </h3>
        <p>
          We use carefully selected third&#8209;party service providers to
          help us operate the Services. These providers process personal
          data only on our instructions and are contractually required to
          use it solely to provide services to BevTek and to protect it
          appropriately. As of the effective date, our key subprocessors
          include:
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>Supabase &mdash; database, authentication, file storage</li>
          <li>Vercel &mdash; application hosting and edge delivery</li>
          <li>Anthropic &mdash; AI model inference for chat and related features</li>
          <li>Retell AI &mdash; voice receptionist, call transport, transcription</li>
          <li>Sendblue &mdash; iMessage/SMS delivery</li>
          <li>Stripe &mdash; payments and billing</li>
          <li>Resend &mdash; transactional email delivery</li>
        </ul>
        <p className="mt-2">
          We may update this list from time to time as we evolve the
          Services. Where required by law or contract, we will enter into
          appropriate data processing agreements (DPAs) and, for
          international transfers, implement Standard Contractual Clauses or
          equivalent mechanisms.
        </p>

        <h3 className="mt-4 font-semibold">
          5.3. Professional advisors and corporate transactions
        </h3>
        <p>We may disclose personal data to:</p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>
            Legal, accounting, auditing, or other professional advisors,
            where necessary to obtain advice or protect our rights
          </li>
          <li>
            A potential buyer, investor, or successor in connection with a
            merger, acquisition, financing, or sale of all or part of our
            business, subject to confidentiality obligations and applicable
            law
          </li>
        </ul>

        <h3 className="mt-4 font-semibold">
          5.4. Legal and regulatory disclosures
        </h3>
        <p>
          We may disclose personal data when we believe in good faith that
          such disclosure is:
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>
            Required by law, regulation, or legal process (e.g., court
            orders, subpoenas)
          </li>
          <li>
            Necessary to respond to lawful requests from public or government
            authorities
          </li>
          <li>
            Necessary to protect the rights, property, or safety of BevTek,
            our customers, users, or the public
          </li>
          <li>
            Necessary to detect, prevent, or address fraud, security, or
            technical issues
          </li>
        </ul>

        <h3 className="mt-4 font-semibold">
          5.5. Aggregated or de&#8209;identified data
        </h3>
        <p>
          We may share aggregated, anonymized, or de&#8209;identified
          information that does not reasonably identify any individual with
          third parties for research, analytics, or product improvement. We
          do not attempt to re&#8209;identify individuals from this data.
        </p>
      </Section>

      <Section title="6. International data transfers">
        <p>
          BevTek is based in the United States and uses service providers
          that may process personal data in the United States and other
          countries.
        </p>
        <p className="mt-2">
          If you access the Services from the EEA, UK, or other regions with
          data protection laws that differ from those in the United States,
          please note that we may transfer your personal data to countries
          that may not provide the same level of data protection as your home
          jurisdiction.
        </p>
        <p className="mt-2">
          Where required by law, we use appropriate safeguards to protect
          personal data during such transfers, such as:
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>
            Standard Contractual Clauses approved by the European Commission
          </li>
          <li>
            The UK International Data Transfer Addendum or equivalent
            mechanisms for UK transfers
          </li>
          <li>Other contractual, organizational, and technical measures</li>
        </ul>
        <p className="mt-2">
          You may contact us at{" "}
          <a className="underline" href="mailto:privacy@bevtek.ai">
            privacy@bevtek.ai
          </a>{" "}
          for more information about these safeguards or to request a copy
          (subject to redaction for confidentiality).
        </p>
      </Section>

      <Section title="7. Data retention">
        <p>
          We retain personal data for as long as necessary to fulfill the
          purposes described in this Policy, unless a longer retention period
          is required or permitted by law.
        </p>
        <p className="mt-2">In particular:</p>
        <p className="mt-3 font-medium">
          Retailer account and configuration data
        </p>
        <p>
          Retained for the life of the retailer account and for up to 90
          days after cancellation to support export, dispute resolution, and
          account recovery, unless a longer period is needed to comply with
          legal obligations or to establish, exercise, or defend legal
          claims.
        </p>
        <p className="mt-3 font-medium">
          Call, chat, and message transcripts for shoppers
        </p>
        <p>
          Retained in accordance with the retailer&rsquo;s configured
          retention settings, subject to applicable law and technical limits.
          Retailers may choose shorter windows for their own compliance or
          preference. We may retain limited records beyond that window where
          required by law or carrier rules, or to resolve disputes and
          investigate abuse.
        </p>
        <p className="mt-3 font-medium">Text messaging opt&#8209;out records</p>
        <p>
          Retained for as long as telecommunications and applicable consumer
          protection rules require, even if the related retailer account is
          closed, to ensure that opt&#8209;out preferences are honored.
        </p>
        <p className="mt-3 font-medium">Logs and security data</p>
        <p>
          Retained for a period that is reasonably necessary for security,
          auditing, debugging, and analytics (typically between 30 and 365
          days, depending on the log type), unless a longer period is
          required for incident investigations or legal purposes.
        </p>
        <p className="mt-3">
          When we no longer need personal data for the purposes described,
          we will delete or anonymize it, or, if that is not possible (for
          example, because it is stored in backup archives), we will securely
          store it and isolate it from further processing until deletion is
          feasible.
        </p>
      </Section>

      <Section title="8. Security">
        <p>
          We use technical and organizational measures designed to protect
          personal data against accidental or unlawful destruction, loss,
          alteration, unauthorized disclosure, or access. These measures
          include:
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>Encryption of data in transit (TLS) and at rest</li>
          <li>Role&#8209;based access controls and authentication safeguards</li>
          <li>
            Row&#8209;level security in our primary database to isolate each
            retailer&rsquo;s data
          </li>
          <li>
            Secret management and rotation policies for service&#8209;role
            keys and webhook secrets
          </li>
          <li>
            Logging, monitoring, and automated secret scanning in our
            development workflows
          </li>
          <li>Regular backups and business continuity planning</li>
        </ul>
        <p className="mt-2">
          However, no method of transmission over the internet or method of
          electronic storage is completely secure. While we strive to protect
          your personal data, we cannot guarantee absolute security.
        </p>
        <p className="mt-2">
          If we become aware of a data breach that affects your personal data
          in a way that presents a high risk to your rights and freedoms, we
          will notify you and/or the relevant retailer and regulators as
          required by applicable law.
        </p>
      </Section>

      <Section title="9. Your rights and choices">
        <p>
          Your privacy rights depend on your location and how we interact
          with you. We strive to honor valid rights requests from
          individuals, either directly (where we are a controller/business)
          or in coordination with the relevant retailer (where we are a
          processor/service provider).
        </p>

        <h3 className="mt-4 font-semibold">9.1. Rights available to many users</h3>
        <p>Subject to applicable law, you may have the right to:</p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>
            <strong>Access</strong> &mdash; Request confirmation of whether we
            process your personal data and receive a copy.
          </li>
          <li>
            <strong>Correction (rectification)</strong> &mdash; Ask us to
            correct inaccurate or incomplete personal data.
          </li>
          <li>
            <strong>Deletion (erasure)</strong> &mdash; Request deletion of
            your personal data, subject to certain exceptions (e.g., legal
            obligations, ongoing disputes).
          </li>
          <li>
            <strong>Restriction</strong> &mdash; Ask us to restrict
            processing of your personal data in certain circumstances.
          </li>
          <li>
            <strong>Objection</strong> &mdash; Object to certain processing,
            including where we rely on legitimate interests.
          </li>
          <li>
            <strong>Portability</strong> &mdash; Request a copy of your
            personal data in a structured, commonly used, machine&#8209;readable
            format, where processing is based on consent or contract and
            carried out by automated means.
          </li>
          <li>
            <strong>Withdraw consent</strong> &mdash; Where we rely on your
            consent, you can withdraw it at any time, without affecting the
            lawfulness of processing already carried out.
          </li>
        </ul>

        <h3 className="mt-4 font-semibold">9.2. California privacy rights (CCPA/CPRA)</h3>
        <p>
          If you are a California resident, you may have additional rights
          under the California Consumer Privacy Act (as amended by the
          CPRA), including the right to:
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>
            Know the categories and specific pieces of personal information
            we have collected about you
          </li>
          <li>
            Know the categories of sources from which we collected personal
            information
          </li>
          <li>Know the purposes for which we use personal information</li>
          <li>
            Know the categories of third parties with whom we disclose
            personal information
          </li>
          <li>
            Request deletion of your personal information (subject to
            certain exceptions)
          </li>
          <li>Request correction of inaccurate personal information</li>
          <li>
            Request information about personal information &ldquo;sold&rdquo;
            or &ldquo;shared&rdquo; (as those terms are defined under
            California law) and to opt out of such &ldquo;sales&rdquo; or
            &ldquo;sharing&rdquo;
          </li>
          <li>Not be discriminated against for exercising your privacy rights</li>
        </ul>
        <p className="mt-2">
          BevTek does not sell or share personal data for
          cross&#8209;context behavioral advertising as those terms are
          defined under California law. If this changes, we will update this
          Policy and provide appropriate notices and opt&#8209;out
          mechanisms.
        </p>

        <h3 className="mt-4 font-semibold">9.3. Exercising your rights</h3>
        <p className="font-medium">Retailers and staff</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            You can access, update, or delete much of your account and store
            data directly via the BevTek dashboard.
          </li>
          <li>
            For additional requests, contact us at{" "}
            <a className="underline" href="mailto:privacy@bevtek.ai">
              privacy@bevtek.ai
            </a>{" "}
            from the email address associated with your account, and we will
            assist you.
          </li>
        </ul>
        <p className="mt-3 font-medium">Shoppers</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            For SMS/iMessage communications, you can reply <code>STOP</code>{" "}
            at any time to opt out of further messages from that
            BevTek&#8209;powered number.
          </li>
          <li>
            To request access to or deletion of your messages and associated
            phone number from a particular store&rsquo;s logs, email{" "}
            <a className="underline" href="mailto:privacy@bevtek.ai">
              privacy@bevtek.ai
            </a>{" "}
            and include:
            <ul className="ml-5 mt-1 list-disc space-y-0.5">
              <li>The phone number you used</li>
              <li>The approximate timeframe and store (if known)</li>
            </ul>
          </li>
          <li>
            In many cases, we will coordinate with the relevant retailer,
            who acts as the primary controller/business for that shopper
            data.
          </li>
        </ul>
        <p className="mt-3">
          We may need to verify your identity (for example, by confirming
          control of the phone number or email address you provide) before
          responding to a rights request. We may deny or limit requests where
          we are unable to verify your identity, where another party&rsquo;s
          rights would be affected, or where we need to retain data for
          legal, security, or compliance reasons. Where we act solely as a
          processor/service provider, we may refer your request to the
          relevant retailer.
        </p>
      </Section>

      <Section title="10. Children's privacy and age-restricted products">
        <p>
          The Services are designed for use by beverage retailers and adult
          shoppers. We do not knowingly collect personal data from children
          under the age of 13 (or a higher age of consent where required by
          local law), and we do not target or direct the Services to
          children.
        </p>
        <p className="mt-2">
          Shopper&#8209;facing AI assistants and tools are explicitly
          restricted from recommending or facilitating the sale of alcoholic
          beverages to anyone who appears to be under the applicable legal
          drinking age. Retailers are responsible for their own
          age&#8209;verification practices offline (e.g., ID checks at the
          point of sale).
        </p>
        <p className="mt-2">
          If you believe we have collected personal data from a child in
          violation of this Policy, please contact us at{" "}
          <a className="underline" href="mailto:privacy@bevtek.ai">
            privacy@bevtek.ai
          </a>
          , and we will take appropriate steps to delete the data and, if
          necessary, terminate the associated account or access.
        </p>
      </Section>

      <Section title="11. Cookies and similar technologies">
        <p>Our use of cookies and similar technologies is intentionally limited:</p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>
            We may use first&#8209;party cookies or local storage to remember
            session state, authentication, and basic preferences.
          </li>
          <li>
            We may use first&#8209;party analytics or privacy&#8209;respecting
            tools to understand aggregate usage of retailer dashboards and
            shopper&#8209;facing sites (e.g., page views, feature adoption).
          </li>
          <li>
            We do not use third&#8209;party advertising cookies or track
            individuals across unrelated websites for behavioral advertising.
          </li>
        </ul>
        <p className="mt-2">
          Where required by law (e.g., in the EEA/UK), we may display a
          notice or banner and, where necessary, request your consent for
          certain cookies or similar technologies. You can manage cookie
          preferences through your browser or device settings, though
          disabling some cookies may limit the functionality of the
          Services.
        </p>
      </Section>

      <Section title="12. Changes to this Privacy Policy">
        <p>
          We may update this Privacy Policy from time to time to reflect
          changes in our Services, our data practices, or applicable laws.
          When we make material changes, we will:
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>
            Update the &ldquo;Effective date&rdquo; at the top of this page,
            and
          </li>
          <li>
            Notify retailers by email or through in&#8209;app notices, and
          </li>
          <li>
            Where required by law, obtain your consent to material changes.
          </li>
        </ul>
        <p className="mt-2">
          We encourage you to review this Policy periodically to stay
          informed about our privacy practices.
        </p>
      </Section>

      <Section title="13. Contact us">
        <p>
          If you have any questions, concerns, or complaints about this
          Privacy Policy or our data practices, or if you wish to exercise
          your rights, please contact us:
        </p>
        <ul className="ml-5 mt-2 list-none space-y-1">
          <li>
            Email:{" "}
            <a className="underline" href="mailto:privacy@bevtek.ai">
              privacy@bevtek.ai
            </a>
          </li>
          <li>Postal mail: {POSTAL_ADDRESS}</li>
        </ul>
        <p className="mt-2">
          If you are in the EEA, UK, or another jurisdiction that provides
          a right to lodge a complaint with a supervisory authority, you may
          also have the right to contact your local data protection
          authority. We would, however, appreciate the chance to address
          your concerns first.
        </p>
      </Section>

      <div className="mt-12 border-t border-[color:var(--color-border)] pt-6 text-xs text-[color:var(--color-muted)]">
        <Link href="/" className="underline">
          Back to home
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="underline">
          Terms of service
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
