import Image from "next/image";

// Deterministic pastel gradient based on item name — makes the placeholder
// feel intentional and gives each product a distinct look.
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

const PALETTES = [
  ["#FBF7F0", "#EED9B8"],
  ["#F5F1EA", "#D9C3A0"],
  ["#FAF5EE", "#E5CFA8"],
  ["#F8F3E9", "#C8984E"],
  ["#EFEAE0", "#B8863C"],
];

export function ProductImage({
  src,
  alt,
  brand,
  size = "md",
}: {
  src: string | null;
  alt: string;
  brand: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const dims = {
    sm: "h-28",
    md: "h-40",
    lg: "h-72",
  }[size];

  if (src) {
    return (
      <div
        className={`relative w-full ${dims} bg-zinc-50 rounded-md overflow-hidden`}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 300px"
          className="object-contain"
          unoptimized
        />
      </div>
    );
  }

  const palette = PALETTES[hash(alt) % PALETTES.length];
  const initials = (brand ?? alt)
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={`w-full ${dims} rounded-md flex items-center justify-center relative overflow-hidden`}
      style={{
        background: `linear-gradient(135deg, ${palette[0]} 0%, ${palette[1]} 100%)`,
      }}
    >
      <span className="text-3xl font-semibold tracking-tight text-white/90 drop-shadow-sm">
        {initials || "—"}
      </span>
    </div>
  );
}
