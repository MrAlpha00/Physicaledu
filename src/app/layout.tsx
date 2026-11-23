import type { Metadata } from "next";
import { Barlow_Condensed, Manrope } from "next/font/google";
import "@xyflow/react/dist/style.css";
import "./globals.css";

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

export const metadata: Metadata = {
  title: {
    default: "VARSITY | College PE Department",
    template: "%s | VARSITY PE",
  },
  description:
    "The digital home of the college Physical Education Department: student accounts, PE membership and department administration.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
