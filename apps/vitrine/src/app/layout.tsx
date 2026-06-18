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

// Socle SEO de base (Story 1.6) — métadonnées TEXTUELLES uniquement (Garde-fou n°7).
// `metadataBase` sert les URL canoniques/OG absolues. Surchargeable par
// NEXT_PUBLIC_SITE_URL (staging / preview Vercel) pour éviter des canoniques/og:url
// pointant vers la prod ; fallback = domaine cible (déploiement réel en Story 1.8).
// `title.template` préfixe les titres des pages enfants.
// Pas d'image OG / favicon custom / sitemap / JSON-LD ici (hors périmètre).
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://esportdessacres.fr",
  ),
  title: {
    default: "Esport des Sacres",
    template: "%s · Esport des Sacres",
  },
  description:
    "Association esport rémoise : agenda des rendez-vous du jeudi, animations, interventions et tournois. Une communauté locale, chaleureuse et bien entourée.",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Esport des Sacres",
    title: "Esport des Sacres",
    description:
      "Association esport rémoise : agenda des rendez-vous du jeudi, animations, interventions et tournois.",
  },
  robots: { index: true, follow: true },
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
