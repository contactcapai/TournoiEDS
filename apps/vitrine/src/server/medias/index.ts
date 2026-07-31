// `server-only` en TOUTE PREMIÈRE LIGNE, comme `db/client.ts` et `db/queries/*`
// (Garde-fou n°1 de la Story 1.7) : ce module lit le DISQUE, il ne doit jamais être
// atteint depuis un composant client. Un chemin système dans un bundle navigateur serait
// une fuite d'information à lui seul.
import "server-only";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { EXTENSIONS } from "../../lib/schemas/photo";

/**
 * Accès en lecture au volume Docker des médias (Story 4.3, AR-DB3).
 *
 * 🔴 CE MODULE EST LA SEULE PORTE ENTRE UNE VALEUR DE BASE ET LE SYSTÈME DE FICHIERS.
 * Il n'y en a pas d'autre, et il ne doit pas y en avoir : tout code qui construirait
 * lui-même un chemin vers `MEDIA_DIR` contournerait les gardes ci-dessous.
 *
 * ⚠️ Le risque n'existait pas avant la révision d'architecture du 2026-07-29 : Supabase
 * Storage servait les fichiers, l'application ne touchait jamais au disque. Sa sortie a
 * transféré cette responsabilité ici — c'est le prix assumé de la simplification, et
 * c'est cette story qui le paie.
 */

/**
 * 🔴 LA RACINE VIENT D'UNE VARIABLE D'ENVIRONNEMENT, JAMAIS D'UN CHEMIN EN DUR — ET LA
 * RAISON EST UN DÉFAUT RÉEL, MESURÉ AU CADRAGE DE CETTE STORY.
 *
 * `docker/docker-compose.yml` montait le volume sur `/app/apps/vitrine/medias`, alors que
 * le `Dockerfile` fixe `WORKDIR /repo` et lance `node apps/vitrine/server.js` : l'app vit
 * sous `/repo/apps/vitrine/`. Le montage désignait donc un chemin **sans aucun rapport**
 * avec l'arborescence réelle du conteneur.
 *
 * ⚠️ ET LE MODE DE DÉFAILLANCE EST LE PIRE POSSIBLE : Docker **crée** le point de
 * montage, `docker compose up` **réussit**, le conteneur démarre, le healthcheck passe,
 * et `backup-medias.sh` sauvegarde consciencieusement un volume qui existe — pendant que
 * l'application ne trouve **aucun** fichier. Rien ne le signale avant qu'un visiteur ne
 * voie une galerie de 404. Même famille que **R21** (la base `vitrine` créée à la main,
 * dont l'échec ne se voyait qu'au premier appel réel).
 *
 * Deux chemins en dur des deux côtés se re-désynchroniseraient au premier changement de
 * `WORKDIR`. Une variable lue par le code ET utilisée comme cible de montage rend
 * l'accord **vérifiable** au lieu d'être supposé.
 */
const VARIABLE = "MEDIA_DIR";

/**
 * Résolution PARESSEUSE, et c'est la même garde que `db/client.ts` : l'erreur tombe au
 * premier USAGE, jamais à l'import.
 *
 * 🔴 Sans cela, le `build` casserait. La CI tourne **sans aucun secret** et sans
 * `.env.local` (garde-fou n°2 de la Story 1.7, structurel dans `.github/workflows/ci.yml`) :
 * un module qui lirait `process.env.MEDIA_DIR` au moment de l'import ferait échouer
 * `next build` dès qu'une page l'atteint dans son graphe.
 *
 * Singleton via `globalThis` : évite de re-résoudre à chaque hot-reload de `next dev`.
 */
const g = globalThis as unknown as { _mediaRoot?: string };

function resoudreRacine(): string {
  const brut = process.env[VARIABLE];
  if (!brut || brut.trim() === "") {
    throw new Error(
      `${VARIABLE} manquante : renseigner apps/vitrine/.env.local (voir .env.example). ` +
        "En développement, un dossier local suffit (ex. MEDIA_DIR=./medias) ; en " +
        "production c'est le point de montage du volume Docker `eds-medias`.",
    );
  }
  // `resolve` depuis le cwd du process : un chemin relatif en développement
  // (`./medias`) devient absolu une fois pour toutes, ce qui rend la comparaison de
  // préfixe ci-dessous fiable. En production la valeur est déjà absolue.
  //
  // ⚠️ UN CHEMIN RELATIF DÉPEND DONC DU RÉPERTOIRE DE LANCEMENT, et ce n'est pas
  // théorique : `pnpm --filter vitrine start` lance avec le cwd du paquet
  // (`apps/vitrine`) et trouve bien `./medias` ; un `npx next start apps/vitrine` lancé
  // depuis la RACINE du monorepo résout vers `<racine>/medias`, qui n'existe pas.
  const racineResolue = path.resolve(brut);

  // 🔴 AVERTISSEMENT BRUYANT SI LA RACINE N'EXISTE PAS — et cette garde est née d'un
  // défaut RÉEL, trouvé pendant cette story par le témoin nominal de la batterie de
  // traversée : la route rendait 404 sur TOUT, y compris sur la photo réellement
  // présente. Sans ce témoin, la conclusion aurait été « neuf traversées bloquées, la
  // route est sûre » — alors qu'elle ne servait rien (`pieges/instrument-non-valide.md`).
  //
  // C'est le MÊME mode de défaillance que le montage Docker corrigé par cette story, et
  // que la dette R21 : tout réussit, rien ne fonctionne. On ne LÈVE pas (une racine
  // absente doit produire des 404 par photo, pas une page en erreur — NFR8), mais on
  // refuse de rester silencieux.
  if (!existsSync(racineResolue)) {
    console.warn(
      `[medias] ${VARIABLE}="${brut}" résolu en "${racineResolue}", qui N'EXISTE PAS. ` +
        "Toutes les photos répondront 404. " +
        `Répertoire de lancement : "${process.cwd()}" — un ${VARIABLE} relatif se résout ` +
        "contre lui, pas contre la racine du dépôt.",
    );
  }
  return racineResolue;
}

/** Racine du volume, absolue. Ne PAS l'exporter : rien d'autre n'a à construire de chemin. */
function racine(): string {
  return (g._mediaRoot ??= resoudreRacine());
}

/**
 * 🔴 TABLE DE CORRESPONDANCE CLOSE — le `Content-Type` n'est JAMAIS deviné, jamais repris
 * d'un en-tête de requête, jamais dérivé d'autre chose que l'extension **relue en base**.
 *
 * Dérivée d'`EXTENSIONS` par construction : `Record<(typeof EXTENSIONS)[number], string>`
 * fait **échouer le typecheck** si un format est ajouté à la liste sans lui donner de
 * type MIME. C'est le même motif que le `Record<PartnerCategory, string>` exhaustif des
 * libellés de mur (Story 4.2, AC3) — une liste qui grandit ne doit pas pouvoir laisser un
 * trou en silence.
 */
const TYPES_MIME: Record<(typeof EXTENSIONS)[number], string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

export type MediaTrouve = {
  flux: ReadableStream<Uint8Array>;
  typeMime: string;
  taille: number;
};

/**
 * Ouvre un média du volume à partir d'un nom de fichier **déjà validé contre la base**.
 *
 * 🔴 CE QUE CETTE FONCTION N'EST PAS : un point d'entrée pour une valeur venue d'une URL.
 * Son appelant (`app/medias/[filename]/route.ts`) DOIT avoir trouvé une ligne `photo`
 * publiée portant exactement ce nom **avant** de l'appeler. Le paramètre s'appelle
 * `nomValideEnBase` pour que la relecture d'un appel le rappelle.
 *
 * Elle re-valide malgré tout — DÉFENSE EN PROFONDEUR, pas redondance décorative :
 *   ① `path.basename` : neutralise toute composante de chemin qui aurait survécu ;
 *   ② comparaison de PRÉFIXE sur le chemin résolu : si un `CHECK` était un jour relâché,
 *      ou si la table était peuplée par une restauration antérieure à cette story, cette
 *      ligne tient encore.
 * Le coût est nul ; le jour où elle sert, elle est la dernière.
 *
 * @returns `null` si le fichier n'existe pas, n'est pas un fichier régulier, ou si son
 *   chemin sort de la racine. **Ne jette pas** : une photo manquante ne casse pas le
 *   rendu public (NFR8), elle produit un 404.
 */
export async function ouvrirMedia(nomValideEnBase: string): Promise<MediaTrouve | null> {
  const nom = path.basename(nomValideEnBase);
  if (nom !== nomValideEnBase) return null;

  const extension = path.extname(nom).slice(1).toLowerCase();
  const typeMime = TYPES_MIME[extension as (typeof EXTENSIONS)[number]];
  if (!typeMime) return null;

  const base = racine();
  const chemin = path.resolve(base, nom);
  // ⚠️ `base + path.sep` et non `base` seul : sans le séparateur, un répertoire voisin
  // nommé `mediasX` passerait le test de préfixe de `medias`.
  if (!chemin.startsWith(base + path.sep)) return null;

  let infos;
  try {
    infos = await stat(chemin);
  } catch {
    // ENOENT, EACCES, ELOOP… : dans tous les cas le média n'est pas servable.
    return null;
  }
  // Un lien symbolique vers l'extérieur du volume : `stat` suit les liens, donc un lien
  // pointant sur `/etc/passwd` renverrait bien un fichier régulier. Le nom, lui, ne peut
  // pas contenir de séparateur — le lien devrait donc avoir été créé DANS le volume, ce
  // qui suppose déjà un accès au conteneur. Garde conservée pour ce qu'elle coûte.
  if (!infos.isFile()) return null;

  // `createReadStream` et non `readFile` : une photo haute définition ne doit pas être
  // chargée entièrement en mémoire à chaque requête. `Readable.toWeb` donne le flux
  // attendu par la `Response` de Next.
  const flux = Readable.toWeb(createReadStream(chemin)) as ReadableStream<Uint8Array>;
  return { flux, typeMime, taille: infos.size };
}
