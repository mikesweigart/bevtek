import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BevTek", template: "%s · BevTek" },
  description:
    "Megan is the AI platform for beverage retail — Trainer, Assistant, Receptionist, Shopper, and Texting in one place.",
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
