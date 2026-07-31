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
    // d'optimiser N'IMPORTE QUEL chemin local — y compris une route qu'on n'a pas
    // pensee comme une source d'images. Ici une seule surface passe par l'optimiseur :
    // la route de service des medias.
    // ⚠️ `search: ""` INTERDIT toute chaine de requete, sur recommandation explicite de
    // la doc : omettre ce champ autorise tous les parametres, ce qui permettrait de
    // faire calculer autant de rendus distincts qu'on invente de `?v=`.
    // ⚠️ Le hero (`/photos/...`) et les logos partenaires (`/partenaires/...`) ne sont
    // PAS listes, et c'est correct : ils sont rendus avec `unoptimized`, donc ils ne
    // passent pas par l'optimiseur. Retirer `unoptimized` de l'un d'eux SANS l'ajouter
    // ici le ferait repondre 400 — echec BRUYANT et immediat, ce qui est le bon
    // comportement pour une liste blanche.
    localPatterns: [{ pathname: "/medias/**", search: "" }],
  },
};

export default nextConfig;
