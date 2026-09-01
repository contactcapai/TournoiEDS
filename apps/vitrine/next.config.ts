import {
  CHEMIN_CONNEXION,
  CHEMIN_CONNEXION_HERITE,
  CHEMIN_CONNEXION_VERIFIER,
  CHEMIN_CONNEXION_VERIFIER_HERITE,
} from "./src/lib/auth/chemins";
import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // ══════════════════════════════════════════════════════════════════════════════════
  // LES DEUX CHEMINS HÉRITÉS DE LA CONNEXION — STORY 12.4
  // ══════════════════════════════════════════════════════════════════════════════════
  //
  // 🔴 `permanent: false` (307/308 temporaire) ET NON `true`, DÉLIBÉRÉMENT. Un permanent
  // est mis en cache par le navigateur *sans date d'expiration* : le jour où on voudrait
  // rendre `/admin/login` à autre chose, les postes qui l'ont visité une fois
  // continueraient de sauter vers `/connexion` sans jamais redemander au serveur. Une
  // redirection qu'on ne peut plus retirer n'est pas un gain de SEO ici — ces deux URLs
  // portent `robots: noindex`.
  //
  // ⚠️ LA QUERY EST CONSERVÉE PAR NEXT : `/admin/login?next=/tournois/x` arrive sur
  // `/connexion?next=/tournois/x`. C'est le point à vérifier par l'EFFET et non par le
  // code de statut — une redirection qui perd `next` renverrait le joueur sur son profil
  // au lieu du tournoi où il voulait s'inscrire, et le 307 serait vert pendant ce temps.
  async redirects() {
    return [
      { source: CHEMIN_CONNEXION_HERITE, destination: CHEMIN_CONNEXION, permanent: false },
      {
        source: CHEMIN_CONNEXION_VERIFIER_HERITE,
        destination: CHEMIN_CONNEXION_VERIFIER,
        permanent: false,
      },
    ];
  },

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
  // Migrations Drizzle dans le standalone (Story 7.4)
  // ══════════════════════════════════════════════════════════════════════════════
  // 🔴 LE CODE EST BUNDLE, LES .sql NE LE SONT PAS. `src/instrumentation.ts` joue les
  // migrations au demarrage ; son code et ses imports (`drizzle-orm/postgres-js/migrator`)
  // entrent dans les chunks serveur parce que Next les bundle. Les fichiers de migration,
  // eux, sont de la DONNEE lue a l'execution par `migrate({ migrationsFolder })` : le
  // traceur ne peut pas les deviner, il faut les declarer.
  // ⚠️ SANS CE BLOC, LE MODE DE DEFAILLANCE EST LE PIRE POSSIBLE : l'image se construit,
  // le conteneur demarre, et `migrerAuDemarrage()` ne trouve pas `meta/_journal.json` —
  // c'est-a-dire un site en ligne sur une base SANS TABLES. D'ou la sortie en code 1 cote
  // migrate.ts plutot qu'un simple avertissement (pieges/faux-succes.md).
  // Les deux motifs sont necessaires : les `.sql` (le contenu joue) ET `meta/` (le journal
  // + les snapshots, sans lesquels drizzle ne sait pas ce qui reste a appliquer).
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**/*.sql", "./drizzle/meta/**/*.json"],
  },
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
      // 🔴 PAS D'ENTRÉE POUR `/admin/medias/**`, ET C'EST UN FAIT MESURÉ AU GATE VISUEL
      // DE LA STORY 6.4 — la première version en posait une, et elle ne servait RIEN.
      // Les deux `400` de l'optimiseur ne disent pas la même chose :
      //   · chemin hors liste  → « "url" parameter is not allowed »   (le motif refuse)
      //   · /admin/medias/…    → « The requested resource isn't a valid image. »
      // Le motif était donc accepté ; ce qui échouait, c'est la RÉCUPÉRATION. L'optimiseur
      // requête **depuis le serveur, sans cookie de session** : il reçoit le `307 →
      // /connexion` de la garde. ⇒ Une ressource protégée par une session ne peut PAS
      // transiter par `/_next/image`, quelle que soit cette liste.
      // ⇒ Les écrans d'administration servent donc leurs images en `unoptimized`, et cette
      // entrée a été RETIRÉE : une autorisation que plus rien ne consomme est une « porte
      // sans pièce », le défaut que `_sections.ts` documente pour l'avoir vu deux fois.
      // ⚠️ Et le retrait est une GARDE, pas un ménage : il empêche qu'une variante optimisée
      // d'un BROUILLON soit un jour écrite dans `.next/cache/images`.
      // `gate:galerie` vérifie que ce chemin reste refusé par l'optimiseur.
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
