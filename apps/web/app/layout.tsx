import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterServiceWorker } from "./_pwa/RegisterServiceWorker";

export const metadata: Metadata = {
  title: { default: "BevTek", template: "%s · BevTek" },
  description:
    "Megan is the AI platform for beverage retail — Trainer, Assistant, Receptionist, Shopper, and Texting in one place.",
  // Next.js auto-resolves this against app/manifest.ts and emits
  // <link rel="manifest" href="/manifest.webmanifest">.
  manifest: "/manifest.webmanifest",
  // iOS home-screen polish. `capable: true` makes iOS treat the
  // installed PWA as a standalone app (no Safari chrome). Status bar
  // "default" keeps the bar legible against our gold theme — the
  // `black-translucent` option draws the page UNDER the status bar,
  // which would clip the top nav.
  appleWebApp: {
    capable: true,
    title: "BevTek",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "BevTek · Meet Megan",
    description:
      "The AI platform for beverage retail. One team member who never sleeps.",
    type: "website",
    siteName: "BevTek",
  },
  twitter: {
    card: "summary_large_image",
    title: "BevTek · Meet Megan",
    description: "The AI platform for beverage retail.",
  },
};

// Viewport metadata is split out from `metadata` per Next.js 15+ API.
// `themeColor` paints the address bar (Android Chrome) and the
// title-bar tint when running standalone. Matches --color-gold from
// globals.css and theme_color in the manifest.
//
// `viewportFit: "cover"` lets the app draw under the iPhone notch
// when launched from the home screen — combined with safe-area
// padding on the in-app shell, this is what makes the install feel
// native rather than embedded-Safari-y.
export const viewport: Viewport = {
  themeColor: "#c8984e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
