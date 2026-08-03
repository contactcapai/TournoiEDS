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
      // 🔴 AJOUTÉE PAR LA STORY 6.4 — les BROUILLONS du back-office, servis par
      // `app/admin/medias/[filename]/route.ts` (gardée par `lireAdmin()`, en `no-store`).
      // Sans cette entrée, les vignettes de l'écran de galerie et l'aperçu des brouillons
      // répondraient **400** : c'est exactement la régression de la Story 4.3, qui a fait
      // disparaître le logo EDS du header et du footer des 5 pages avec lint, typecheck,
      // build, `gate`, `gate:lightbox` et Lighthouse TOUS VERTS. `pnpm gate:images` est le
      // témoin, et il a été rejoué.
      // ⚠️ Cette liste n'ouvre AUCUN accès : elle autorise l'optimiseur à traiter ce
      // chemin, elle ne contourne pas la garde de la route (qui reste seule à décider).
      { pathname: "/admin/medias/**", search: "" },
    ],
  },
  experimental: {
    serverActions: {
      /**
       * 🔴 FIXÉ EXPLICITEMENT, PARCE QUE LE DÉFAUT EST 1 Mo ET QU'IL NE PARLE PAS.
       *
       * Mesuré dans `node_modules/next/dist/server/app-render/action-handler.js`
       * (l.575-590, Next 16.2.9) : `defaultBodySizeLimit = '1 MB'`, appliqué par un
       * `Transform` posé sur le FLUX DE REQUÊTE, qui lève un `ApiError(413)` **avant que le
       * corps de la Server Action ne s'exécute** — donc avant `requireAdmin()`, avant Zod, et
       * avant tout message écrit par nous.
       *
       * ⚠️ CONSÉQUENCE CONCRÈTE SI ON LAISSE LE DÉFAUT : une photo de téléphone fait 3 à
       * 6 Mo. Le `catch` du formulaire (patron 6.3) afficherait *« Une erreur réseau est
       * survenue »* sur le geste NOMINAL de la Story 6.4 — un diagnostic faux, sur la seule
       * chose que l'écran existe pour rendre possible.
       *
       * 🔴 12 Mo ICI, 10 Mo CÔTÉ CLIENT (`PhotoUploader`), ET L'ÉCART EST LA GARDE. Le
       * multipart transporte plus que l'octet du fichier (frontières, en-têtes, encodage
       * des autres champs) : sans marge, un fichier de 10,0 Mo accepté par le client
       * repartirait en 413 côté serveur, c'est-à-dire exactement le défaut qu'on cherche à
       * éviter. La borne serveur doit rester STRICTEMENT SUPÉRIEURE à la borne client.
       *
       * ⚠️ Les deux bornes sont volontairement hautes : la dette **R15** attend des
       * originaux HAUTE DÉFINITION, et cette story conserve l'original tel quel (arbitrage
       * Q2). Les baisser reviendrait à rendre R15 insoluble.
       */
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
