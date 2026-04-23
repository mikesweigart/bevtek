import Link from "next/link";
import { DMCAForm } from "./DMCAForm";

// DMCA 17 USC 512 takedown notice page.
//
// Public + not gated — rights-holders must be able to submit without
// creating an account. Form posts to /api/legal/dmca which writes to
// dmca_reports (service-role).
//
// This page satisfies the "designated agent" notice requirement as a
// companion to the BevTek DMCA agent registration (filed with US
// Copyright Office; see admin docs). Keep the claims here in sync
// with that registration.
//
// CSAM is handled separately — we link to NCMEC rather than accepting
// the content into our own queue. Holding CSAM in a takedown queue is
// itself a federal issue, so the policy is: don't.

export const metadata = {
  title: "DMCA Takedown — BevTek.ai",
  description:
    "Submit a DMCA 17 USC 512 takedown notice to BevTek.ai for allegedly infringing content.",
};

const DMCA_AGENT_EMAIL = "dmca@bevtek.ai";
const DMCA_AGENT_ADDRESS = "3000 Old Alabama Road, Alpharetta, Georgia, USA";

export default function DMCAPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed text-[color:var(--color-fg)]">
      <p className="mb-2 text-xs uppercase tracking-wider text-[color:var(--color-muted)]">
        Legal
      </p>
      <h1 className="mb-2 text-3xl font-semibold">
        BevTek.ai DMCA Takedown Policy
      </h1>
      <p className="mb-8 text-[color:var(--color-muted)]">
        How to report content you believe infringes your copyright.
      </p>

      <section className="mb-10 space-y-3">
        <h2 className="text-lg font-semibold">1. When to use this form</h2>
        <p>
          Use the form below if you are a copyright owner (or authorized to
          act on behalf of one) and you believe that material appearing on a
          BevTek&#8209;hosted surface infringes your copyright. Most BevTek
          user&#8209;generated content is product photography submitted by
          retail staff; if one of those photos reproduces your work without
          permission, this is the right path.
        </p>
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900">
          <strong>Do not use this form to report child sexual abuse
          material (CSAM).</strong> Report CSAM directly to the{" "}
          <a
            href="https://report.cybertip.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold"
          >
            National Center for Missing &amp; Exploited Children
            (NCMEC) CyberTipline
          </a>
          . BevTek will cooperate with any NCMEC&#8209;referred investigation,
          but we do not accept CSAM content or details into our own queue.
        </p>
      </section>

      <section className="mb-10 space-y-3">
        <h2 className="text-lg font-semibold">2. What the law requires</h2>
        <p>
          A valid notice under 17 U.S.C. § 512(c)(3) must include (all six
          are required):
        </p>
        <ol className="ml-5 list-decimal space-y-1">
          <li>
            A physical or electronic signature of a person authorized to act
            on behalf of the copyright owner.
          </li>
          <li>
            Identification of the copyrighted work claimed to have been
            infringed.
          </li>
          <li>
            Identification of the material that is claimed to be infringing
            and that is to be removed, with enough detail to locate it (a
            URL is usually sufficient).
          </li>
          <li>
            The claimant&rsquo;s contact information — address, phone, and
            email.
          </li>
          <li>
            A statement that the claimant has a good&#8209;faith belief that
            the disputed use is not authorized by the copyright owner, its
            agent, or the law.
          </li>
          <li>
            A statement, under penalty of perjury, that the information in
            the notice is accurate and that the claimant is authorized to
            act on behalf of the owner.
          </li>
        </ol>
        <p className="text-[color:var(--color-muted)]">
          The form below prompts for each of these. Missing any of them
          means the notice is not legally effective and we may not be able
          to act on it.
        </p>
      </section>

      <section className="mb-10 space-y-3">
        <h2 className="text-lg font-semibold">3. Our designated agent</h2>
        <p>
          You may also send a notice directly to our designated agent by
          email or mail instead of using the form:
        </p>
        <div className="rounded-lg border border-[color:var(--color-border)] bg-zinc-50 p-4 text-xs font-mono">
          <div>DMCA Agent — BevTek.ai, Inc.</div>
          <div>{DMCA_AGENT_ADDRESS}</div>
          <div>
            Email:{" "}
            <a
              className="underline"
              href={`mailto:${DMCA_AGENT_EMAIL}`}
            >
              {DMCA_AGENT_EMAIL}
            </a>
          </div>
        </div>
      </section>

      <section className="mb-10 space-y-3">
        <h2 className="text-lg font-semibold">4. Counter-notice</h2>
        <p>
          If you believe your content was removed by mistake, you may send
          a counter&#8209;notice under 17 U.S.C. § 512(g) to the designated
          agent address above. We will pass counter&#8209;notices to the
          original claimant per statute.
        </p>
      </section>

      <section className="mb-10 space-y-3">
        <h2 className="text-lg font-semibold">5. Repeat infringers</h2>
        <p>
          Accounts that receive multiple good&#8209;faith DMCA notices are
          terminated under our repeat&#8209;infringer policy. The BevTek
          Acceptable Use Policy applies in parallel.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Submit a takedown notice</h2>
        <DMCAForm />
      </section>

      <p className="mt-10 text-xs text-[color:var(--color-muted)]">
        See also our{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link href="/terms" className="underline">
          Terms of Service
        </Link>
        .
      </p>
    </main>
  );
}
