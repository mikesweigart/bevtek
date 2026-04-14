// BevTek design tokens — single source of truth shared across web + mobile
export const theme = {
  colors: {
    bg: "#FFFFFF",
    fg: "#111111",
    muted: "#6B7280",
    border: "#E5E7EB",
    gold: "#C8984E",
    goldHover: "#B8863C",
  },
  radius: {
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
  },
  font: {
    sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  },
} as const;

export type Theme = typeof theme;
