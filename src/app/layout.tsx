import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Manrope } from "next/font/google";
import "@xyflow/react/dist/style.css";
import "./globals.css";
import { PwaManager } from "@/components/pwa/pwa-manager";
import { getCanonicalSiteUrl } from "@/lib/env/public";

const heading = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
  fallback: ["Arial Narrow", "sans-serif"],
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  fallback: ["Segoe UI", "sans-serif"],
});

const siteUrl = getCanonicalSiteUrl();
const siteName = "VARSITY — College PE Management Platform";
const siteDescription =
  "The digital home of the college Physical Education Department: student accounts, PE membership, classes, events, games and department administration.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "VARSITY | College PE Department",
    template: "%s | VARSITY PE",
  },
  description: siteDescription,
  applicationName: "VARSITY",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "VARSITY",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false, date: false, address: false, email: false },
  openGraph: {
    type: "website",
    siteName,
    title: "VARSITY | College PE Department",
    description: siteDescription,
    url: siteUrl,
    locale: "en_IN",
    images: [
      {
        url: "/icons/screenshot-wide.png",
        width: 1280,
        height: 720,
        alt: "VARSITY College PE Management Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VARSITY | College PE Department",
    description: siteDescription,
    images: ["/icons/screenshot-wide.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#101D2C" },
    { media: "(prefers-color-scheme: dark)", color: "#101D2C" },
  ],
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body>
        {children}
        <PwaManager />
      </body>
    </html>
  );
}
