import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Metadonnees de transition (FR). Le SEO complet (titre par page, OpenGraph, canonique...) est pose en Story 1.6.
export const metadata: Metadata = {
  title: "Esport des Sacres",
  description: "Association esport rémoise : agenda des rendez-vous, animations et tournois.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
