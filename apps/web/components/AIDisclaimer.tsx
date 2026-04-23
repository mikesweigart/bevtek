/**
 * AI-generated content disclaimer.
 *
 * Renders a compact "AI-generated — verify important details" note under
 * any AI-produced surface (Gabby replies, Megan training content,
 * recommendation cards). Purpose:
 *
 *   1. Reduce tort exposure. If a staff member mis-sells a product
 *      because Megan confidently asserted a wrong fact, a disclaimer
 *      changes the liability calculus.
 *   2. Set user expectations. LLM output is plausibly wrong — customers
 *      and staff should know.
 *   3. Keep the experience consistent. Every AI surface gets the same
 *      visual tell, so users learn "that's the AI badge."
 *
 * Variants:
 *   - "inline" (default): small muted row, use under message bubbles.
 *   - "banner": full-width note at the top of a conversation, use
 *     once-per-session on entry to Gabby/Megan surfaces.
 *   - "footnote": super-compact right-aligned micro-text, use when
 *     real-estate is tight (e.g., below a single recommendation card).
 */

type Variant = "inline" | "banner" | "footnote";

const TEXT: Record<Variant, string> = {
  inline:
    "AI-generated. Double-check facts about stock, price, or pairings with a staff member.",
  banner:
    "This conversation is powered by AI. It may occasionally be wrong — please verify important product details before relying on them.",
  footnote: "AI-generated",
};

export function AIDisclaimer({
  variant = "inline",
  className = "",
}: {
  variant?: Variant;
  className?: string;
}) {
  const base = "text-[11px] leading-tight text-neutral-500";

  if (variant === "banner") {
    return (
      <div
        role="note"
        aria-label="AI disclaimer"
        className={`rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 ${className}`}
      >
        <span className="font-medium">ⓘ {TEXT.banner}</span>
      </div>
    );
  }

  if (variant === "footnote") {
    return (
      <span className={`${base} italic ${className}`}>{TEXT.footnote}</span>
    );
  }

  return (
    <p
      role="note"
      aria-label="AI disclaimer"
      className={`${base} mt-1 italic ${className}`}
    >
      {TEXT.inline}
    </p>
  );
}
