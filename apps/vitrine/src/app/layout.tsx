import type { Metadata } from "next";
import { Bebas_Neue, Roboto, Caveat } from "next/font/google";
// Tokens de la charte EDS (source unique). Importés AVANT globals.css pour que
// les variables :root soient disponibles aux règles du body.
import "@repo/ui/styles/tokens.css";
import "./globals.css";

// Bebas Neue = police STATIQUE : poids 400 seul, aucun italique (cf. Dev Notes 1.2).
const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bebas",
});

// Roboto = police VARIABLE : omettre `weight` (400/500/700 obtenus via font-weight CSS).
// Italique nécessaire pour les légendes/notes → style normal + italic.
const roboto = Roboto({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-roboto",
});

// Caveat = police VARIABLE, sans italique (ne jamais lui appliquer font-style: italic).
const caveat = Caveat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-caveat",
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
    <html
      lang="fr"
      className={`${bebasNeue.variable} ${roboto.variable} ${caveat.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
