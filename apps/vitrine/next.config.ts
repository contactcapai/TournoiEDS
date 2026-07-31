import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Build autonome (binaire + assets minimal) requis pour l'image Docker de la vitrine.
  // Prerequis de la Story 1.8 (deploiement self-hosted Caddy/Docker sur VPS). Pose ici, exploite plus tard.
  output: "standalone",
  // En monorepo, Next doit tracer les fichiers a inclure depuis la RACINE du repo (et non apps/vitrine),
  // sinon le build standalone oublie des deps hoistees -> crash a l'execution (Story 1.8). __dirname = apps/vitrine.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Le design system partage `@repo/ui` est publie en TS/CSS brut (pas de build) : Next doit le transpiler.
  // Declare des maintenant pour que l'import devienne possible des la Story 1.2 (tokens) sans casser le build.
  transpilePackages: ["@repo/ui"],
  // ══════════════════════════════════════════════════════════════════════════════
  // Optimiseur d'images (Story 4.3) — PREMIER bloc `images` du projet.
  // Doc-first fait le 2026-07-31 sur la doc de la version en place (Next 16.2.x).
  // ══════════════════════════════════════════════════════════════════════════════
  images: {
    // 🔴 REQUIS DEPUIS NEXT 16, et pas seulement conseille : un acces non restreint
    // laisserait demander plus de qualites que prevu, donc autant de rendus a calculer
    // et a stocker. `[75]` est la valeur par defaut historique — on la FIGE au lieu de
    // s'y fier implicitement.
    qualities: [75],
    // 🔴 LISTE BLANCHE DES CHEMINS LOCAUX OPTIMISABLES. Sans ce bloc, Next accepte
    // d'optimiser N'IMPORTE QUEL chemin local, et `search` non contraint laisse
    // fabriquer autant de rendus distincts qu'on invente de `?v=` — une amplification
    // gratuite. `search: ""` interdit toute chaine de requete (recommandation explicite
    // de la doc Next).
    //
    // 🔴 CETTE LISTE EST ETABLIE PAR LA MESURE, JAMAIS PAR UN GREP DE `unoptimized`.
    // Regression reelle introduite puis corrigee le 2026-07-31, vue par Brice au gate :
    // la premiere version ne listait que `/medias/**`, au motif — verifie par grep, et
    // FAUX — que tout le reste passait `unoptimized`. Le logo du header ne le passe pas.
    // Resultat : `/_next/image?url=/logo-eds-blanc.png` repondait **400** et LE LOGO
    // AVAIT DISPARU DU HEADER ET DU FOOTER, sur les 5 pages.
    // ⚠️ Rien ne l'a signale : lint, typecheck, build, `gate`, `gate:lightbox` et
    // Lighthouse etaient TOUS VERTS — une image cassee n'est ni un debordement, ni un
    // defaut de contraste, ni un audit d'accessibilite. Seul un oeil l'a vu.
    //
    // La liste ci-dessous vient donc du HTML SERVI : extraction de tous les
    // `_next/image?url=` des 5 pages. C'est ce que verifie desormais `pnpm gate:images`,
    // qui echoue si UNE seule image servie ne repond pas 200.
    // ⚠️ Ajouter une image locale SANS `unoptimized` et SANS l'ajouter ici la fera
    // repondre 400. La porte le dira ; ce commentaire ne suffit pas.
    localPatterns: [
      // Logo EDS — header et footer, donc TOUTES les pages (`components/layout/`).
      { pathname: "/logo-eds-blanc.png", search: "" },
      // Photos de la galerie, servies par `app/medias/[filename]/route.ts`.
      { pathname: "/medias/**", search: "" },
    ],
  },
};

export default nextConfig;
