import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

const FEATURES = [
  {
    name: "Trainer",
    tagline: "Your whole team, always in sync",
    desc: "Publish training modules, track completions, onboard new staff in minutes.",
  },
  {
    name: "Assistant",
    tagline: "A product expert on every shift",
    desc: "Staff ask Megan about any bottle, category, or pairing. Answers grounded in live inventory.",
  },
  {
    name: "Receptionist",
    tagline: "Never miss a call",
    desc: "Megan answers every inbound call, books orders, answers FAQs — 24/7.",
  },
  {
    name: "Shopper",
    tagline: "Your store, on every phone",
    desc: "Mobile-first customer storefront. Browse, search, ask — no app install.",
  },
  {
    name: "Texting",
    tagline: "iMessage is the new receipt",
    desc: "Two-way texting with your customers. Recommendations, order confirmations, back-in-stock alerts.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/dashboard");

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="px-6 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <p className="text-xs sm:text-sm tracking-widest uppercase text-[color:var(--color-muted)]">
            BevTek
          </p>
          <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-tight">
            Meet{" "}
            <span className="text-[color:var(--color-gold)]">Megan</span>.
          </h1>
          <p className="text-lg sm:text-xl text-[color:var(--color-muted)] max-w-2xl mx-auto">
            The AI platform for beverage retail. One team member who never
            sleeps, knows every SKU, and answers every call.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium text-white bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] transition-colors"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium border border-[color:var(--color-border)] hover:border-[color:var(--color-fg)] transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-12 sm:py-20 border-t border-[color:var(--color-border)]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
              Five products. One Megan.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.name}
                className="rounded-lg border border-[color:var(--color-border)] p-6 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-gold)]" />
                  <h3 className="text-sm font-semibold tracking-tight">
                    Megan {f.name}
                  </h3>
                </div>
                <p className="text-base font-medium">{f.tagline}</p>
                <p className="text-sm text-[color:var(--color-muted)] leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 border-t border-[color:var(--color-border)]">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Ready to see your store run itself?
          </h2>
          <p className="text-[color:var(--color-muted)]">
            Sign up in under a minute. No credit card. Import your inventory
            from any spreadsheet.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium text-white bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] transition-colors"
          >
            Start free
          </Link>
        </div>
      </section>

      <footer className="px-6 py-8 border-t border-[color:var(--color-border)] text-center">
        <p className="text-xs text-[color:var(--color-muted)]">
          © {new Date().getFullYear()} BevTek. Made for beverage retail.
        </p>
      </footer>
    </main>
  );
}
