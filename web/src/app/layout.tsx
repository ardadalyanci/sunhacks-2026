import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Bricolage_Grotesque } from "next/font/google";
import { PRODUCT } from "@/components/brand";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
});

// Atkinson Hyperlegible was designed for readers with low vision.
const body = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
  adjustFontFallback: false, // Next has no fallback metrics for this font yet
});

const DESCRIPTION = `ASU Mobile shows your schedule. ${PRODUCT} plans your day: when to leave for each class, in the Tempe heat, with the club nights worth the walk.`;

// Where shared links point. Set NEXT_PUBLIC_SITE_URL when the site moves to its own domain.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sunhacks-2026.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${PRODUCT}: the day planner for ASU students`, template: `%s · ${PRODUCT}` },
  description: DESCRIPTION,
  appleWebApp: { capable: true, title: PRODUCT, statusBarStyle: "default" },
  // The share card (Discord, iMessage, Devpost): the image comes from app/opengraph-image.png.
  openGraph: { type: "website", siteName: PRODUCT, title: `${PRODUCT} plans your day`, description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: `${PRODUCT} plans your day`, description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: "#dcebff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
