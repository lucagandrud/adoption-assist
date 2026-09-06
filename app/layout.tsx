import type { Metadata } from "next";
import { Public_Sans, Source_Serif_4, Geist_Mono } from "next/font/google";
import "./globals.css";

// Public Sans is the USWDS typeface — it reads as government without reading
// as bureaucratic. Source Serif carries the headings so the product feels
// like a case file rather than a SaaS dashboard.
const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: "ICPC Preflight",
  description:
    "Pre-submission verification for interstate placement packets under the Interstate Compact on the Placement of Children.",
  openGraph: {
    title: "ICPC Preflight",
    description: "Administrative readiness for interstate foster-care placement packets.",
    images: [{ url: "/social/icpc-preflight-og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ICPC Preflight",
    description: "Administrative readiness for interstate foster-care placement packets.",
    images: ["/social/icpc-preflight-og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${publicSans.variable} ${sourceSerif.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <div className="h-1 w-full shrink-0 bg-navy-800" />
        {children}
      </body>
    </html>
  );
}
