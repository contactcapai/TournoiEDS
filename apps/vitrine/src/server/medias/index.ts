// `server-only` en TOUTE PREMIÈRE LIGNE, comme `db/client.ts` et `db/queries/*`
// (Garde-fou n°1 de la Story 1.7) : ce module lit le DISQUE, il ne doit jamais être
// atteint depuis un composant client. Un chemin système dans un bundle navigateur serait
// une fuite d'information à lui seul.
import "server-only";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { open, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import sharp from "sharp";

import { LOGO_EXTENSION, LOGO_HAUTEUR, LOGO_LARGEUR_MAX } from "../../lib/logos";
import { EXTENSIONS } from "../../lib/schemas/photo";

/**
 * Accès en lecture ET EN ÉCRITURE au volume Docker des médias (Stories 4.3 puis 6.4).
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

  // ══════════════════════════════════════════════════════════════════════════════════
  // 🔴 ON OUVRE D'ABORD, ON INTERROGE ENSUITE — DETTE **R36**, TRANCHÉE PAR LA MESURE
  // ══════════════════════════════════════════════════════════════════════════════════
  //
  // La version précédente faisait `stat(chemin)` puis `createReadStream(chemin)` : deux
  // résolutions successives du MÊME chemin, donc une fenêtre entre les deux. R36 (revue de
  // la 6.4) soupçonnait une réponse tronquée si un administrateur supprimait le fichier
  // pendant qu'un visiteur le télécharge. **Le rapport disait lui-même que c'était une
  // hypothèse non éprouvée** — elle a donc été MESURÉE avant d'être corrigée, sur les deux
  // plateformes (Windows en dev, **Linux comme en production**) :
  //
  //   · suppression PENDANT la lecture du flux ⇒ lecture **COMPLÈTE**, aucune erreur, sur
  //     les deux plateformes. C'est structurel : sous POSIX le fichier survit à son
  //     `unlink` tant qu'un descripteur le tient, et Node ouvre avec `FILE_SHARE_DELETE`
  //     sous Windows. ⇒ **La course décrite par R36 ne se reproduit pas.**
  //   · suppression ENTRE le `stat()` et l'ouverture ⇒ `ENOENT`, **avant le moindre octet**.
  //     Mais les en-têtes `200` + `Content-Length` sont déjà partis : le client reçoit donc
  //     un corps plus court que promis. Fenêtre de quelques microsecondes, une image, aucun
  //     enjeu de sécurité — mais **réel**, et c'est la seule chose que la mesure a trouvée.
  //
  // ⇒ Le correctif ne coûte rien et ferme la fenêtre par construction : on ouvre le
  // descripteur, on interroge `fstat` **depuis lui**, et le flux naît **du même
  // descripteur**. Il n'y a plus deux résolutions de chemin, donc plus de fenêtre du tout.
  // Mesuré aussi : le flux **referme** le descripteur en fin de lecture (pas de fuite).
  let fh;
  try {
    fh = await open(chemin, "r");
  } catch {
    // ENOENT, EACCES, ELOOP… : dans tous les cas le média n'est pas servable.
    return null;
  }

  let infos;
  try {
    infos = await fh.stat();
  } catch {
    await fh.close();
    return null;
  }

  // Un lien symbolique vers l'extérieur du volume : `open`/`fstat` suivent les liens, donc
  // un lien pointant sur `/etc/passwd` renverrait bien un fichier régulier. Le nom, lui, ne
  // peut pas contenir de séparateur — le lien devrait donc avoir été créé DANS le volume,
  // ce qui suppose déjà un accès au conteneur. Garde conservée pour ce qu'elle coûte.
  // 🔴 ET LE DESCRIPTEUR SE FERME SUR CE CHEMIN DE REFUS : un `return null` nu ici
  // transformerait le correctif de R36 en FUITE DE DESCRIPTEURS, c'est-à-dire un défaut
  // pire que celui qu'on vient de fermer.
  if (!infos.isFile()) {
    await fh.close();
    return null;
  }

  // Flux et non `readFile` : une photo haute définition ne doit pas être chargée entièrement
  // en mémoire à chaque requête. `Readable.toWeb` donne le flux attendu par la `Response` de
  // Next, et `fh.createReadStream()` referme le descripteur en fin de lecture.
  const flux = Readable.toWeb(fh.createReadStream()) as ReadableStream<Uint8Array>;
  return { flux, typeMime, taille: infos.size };
}

// ══════════════════════════════════════════════════════════════════════════════════════
// ÉCRITURE (Story 6.4) — LA PREMIÈRE DU PROJET
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 LA STORY 4.3 N'AVAIT TRAITÉ QUE LA MOITIÉ « LECTURE » DE LA GARDE ANTI-TRAVERSÉE
// (`/medias/[filename]` ne concatène jamais un paramètre d'URL à un chemin). L'autre
// moitié est ici, et elle tient en une phrase : **le nom du fichier stocké est GÉNÉRÉ PAR
// LE SERVEUR**, jamais celui fourni par le navigateur.
//
// ⚠️ ET IL SE JETTE, IL NE SE « NETTOIE » PAS. Nettoyer un nom d'origine, c'est écrire une
// liste noire déguisée : il faudrait penser à `..`, aux séparateurs des deux familles d'OS,
// aux formes Unicode composées, à `%2e%2e`, aux noms réservés de Windows (`CON`, `NUL`)…
// La liste BLANCHE, elle, est déjà écrite deux fois (`photoInputSchema.filename` et le
// `CHECK photo_filename_safe`), et un UUID v4 la satisfait par construction :
//   ① hexadécimal minuscule ⇒ premier caractère ∈ [a-z0-9] ✓
//   ② corps ⊂ [a-z0-9._-] (chiffres, lettres a-f, tirets) ✓
//   ③ aucun `..` ✓
// Il n'y a donc rien à inventer : `randomUUID()` + l'extension déduite du CONTENU.

/**
 * 🔴 CE QUE `sharp` REND VRAIMENT — MESURÉ LE 2026-08-03, ET LE CADRAGE ÉTAIT FAUX.
 *
 * La story annonçait « sharp rend `jpeg`, `png`, `webp`, `avif` ». **Faux pour l'AVIF** :
 * mesuré sur le fichier réel du volume (`soiree-bar-eds-01.avif`) ET sur un AVIF produit
 * par sharp lui-même, `metadata().format` vaut **`"heif"`**, avec `compression: "av1"`.
 * La documentation de `sharp` le dit d'ailleurs en toutes lettres sur `compression` :
 * *« The encoder used to compress an HEIF file, `av1` (AVIF) or `hevc` (HEIC) »*.
 *
 * ⚠️ Écrite telle que le cadrage la décrivait, cette table aurait **refusé tout AVIF** —
 * c'est-à-dire le format de la seule photo du projet, celui que la Story 4.3 a retenu. Et
 * rien ne l'aurait signalé : la table serait restée complète sur ses clés, donc verte au
 * typecheck.
 *
 * 🔴 CONSÉQUENCE SYMÉTRIQUE, ET C'EST ELLE QUI COMPTE POUR LA SÉCURITÉ : `"heif"` désigne
 * AUSSI le HEIC des iPhone, que **les navigateurs ne savent pas afficher**. Accepter
 * `format === "heif"` sans regarder `compression` stockerait un HEIC sous une extension
 * `.avif`, servi en `image/avif` : un cadre cassé, indébuggable depuis l'écran. Le
 * discriminant est donc `compression`, et il a été éprouvé — un AVIF dont on trafique la
 * marque de conteneur en `heic` ressort bien avec `compression: "hevc"`.
 */
const FORMATS_ACCEPTES = ["jpeg", "png", "webp", "avif"] as const;
type FormatAccepte = (typeof FORMATS_ACCEPTES)[number];

/**
 * `format sharp → extension stockée`. **L'identité n'est PAS la règle** : sharp dit
 * `jpeg`, la liste blanche dit `jpg`.
 *
 * ⚠️ DEUX EXHAUSTIVITÉS, ET ELLES SONT TENUES PAR LE TYPE, pas par la relecture :
 *   · la CLÉ est `FormatAccepte` ⇒ ajouter un format accepté sans lui donner d'extension
 *     fait échouer le typecheck ;
 *   · la VALEUR est `(typeof EXTENSIONS)[number]` ⇒ on ne peut pas produire une extension
 *     que le `CHECK` et la table MIME refuseraient ensuite.
 * Même motif que `TYPES_MIME` ci-dessus et que le `Record<PartnerCategory, string>` de la 4.2.
 */
const EXTENSION_PAR_FORMAT: Record<FormatAccepte, (typeof EXTENSIONS)[number]> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  avif: "avif",
};

/**
 * 🔴 PLAFOND DE PIXELS — LA BORNE DE TAILLE DE FICHIER NE PROTÈGE PAS DE ÇA.
 *
 * Défaut trouvé en revue. Le formulaire borne le POIDS (10 Mo), pas les DIMENSIONS — or un
 * PNG compresse un aplat de couleur à presque rien : un fichier de quelques centaines de
 * kilo-octets peut annoncer 30 000 × 30 000. `sharp().metadata()` lit l'en-tête **sans
 * décoder les pixels**, donc il l'accepterait, et l'image serait écrite telle quelle
 * (aucun redimensionnement à l'entrée — arbitrage Q2, assumé).
 *
 * ⚠️ LE DÉFAUT NE SE VERRAIT QU'APRÈS COUP, ET AILLEURS : c'est `next/image` qui décode
 * réellement, à la première vignette. Il heurterait sa limite de pixels et rendrait un
 * **cadre cassé** sur une photo que le formulaire venait pourtant d'accepter — sans qu'aucun
 * message ne relie l'échec à sa cause. Refuser à l'ENTRÉE est le seul endroit où l'on peut
 * encore expliquer.
 *
 * 100 mégapixels : très au-delà de tout appareil réel (un capteur 50 Mpx fait 8000 × 6000,
 * soit 48 Mpx), donc R15 — qui attend des originaux HAUTE DÉFINITION — n'est pas gênée ; et
 * bien en deçà de la limite de décodage de sharp (~268 Mpx), donc la garde tire AVANT elle.
 */
const PIXELS_MAX = 100_000_000;

/** Pourquoi une écriture a été refusée. Les MESSAGES vivent dans la Server Action. */
export type EchecMedia =
  /** `sharp` n'a pas su lire le contenu : ce n'est pas une image, quel que soit son nom. */
  | { motif: "illisible" }
  /** SVG : refus EXPLICITE et nommé — voir ci-dessous. */
  | { motif: "svg" }
  /** Image lisible, mais d'un format hors liste (gif, tiff, heic…). */
  | { motif: "format"; format: string }
  /** Dimensions déclarées hors de tout usage réel — voir `PIXELS_MAX`. */
  | { motif: "dimensions"; largeur: number; hauteur: number }
  /** `MEDIA_DIR` absente, ou désignant un répertoire qui n'existe pas. */
  | { motif: "volume" }
  /** L'écriture elle-même a échoué (droits, disque plein, collision de nom). */
  | { motif: "ecriture" };

export type EcritureMedia = { ok: true; filename: string } | { ok: false; echec: EchecMedia };

/**
 * Écrit une image sur le volume, sous un nom **généré par le serveur**.
 *
 * 🔴 ON VALIDE AVANT D'ÉCRIRE, ET L'ORDRE EST LA GARDE. Le défaut le plus facile à
 * commettre est l'inverse (« j'ai le flux, je le pose, je valide ensuite ») : il laisserait
 * sur le volume des fichiers qu'AUCUNE ligne ne référence, donc qu'aucun écran ne peut
 * supprimer — invisibles, et croissants. `gate:galerie` compte les fichiers du volume avant
 * et après chaque refus, précisément pour que cette phrase reste vraie.
 *
 * 🔴 LE TYPE VIENT DU CONTENU, JAMAIS DU NOM NI DU `Content-Type` ANNONCÉ. Un fichier
 * `photo.png` contenant du texte est refusé ; un exécutable renommé `.jpg` aussi.
 *
 * 🔴 LE SVG EST REFUSÉ **EXPLICITEMENT**, ET CE N'EST PAS UN EFFET DE BORD. `sharp` SAIT
 * lire le SVG (mesuré : `format: "svg"`, dimensions rendues). Un refus qu'on déduirait d'un
 * échec de `sharp` ne refuserait donc RIEN. Or un SVG servi depuis notre propre origine
 * exécute son `<script>` dans le contexte du site : XSS stocké, livré par ce formulaire à un
 * bénévole qui téléverserait un fichier reçu par mail.
 *
 * ⚠️ AUCUN REDIMENSIONNEMENT NI RECOMPRESSION ICI — l'original est conservé tel quel
 * (arbitrage Q2). `next/image` fabrique les variantes au service, et la dette **R15** attend
 * des sources plus GRANDES, pas plus petites : réduire à l'entrée la rendrait insoluble.
 * La normalisation appartient à la Story 6.5, et pour une autre raison (uniformiser un
 * bandeau de logos).
 */
export async function ecrireMedia(contenu: Buffer): Promise<EcritureMedia> {
  const analyse = await analyserImage(contenu, PIXELS_MAX);
  if (!analyse.ok) return { ok: false, echec: analyse.echec };

  const volume = resoudreVolume();
  if (!volume.ok) return { ok: false, echec: volume.echec };

  // 🔴 L'ORIGINAL EST ÉCRIT TEL QUEL — voir le bloc de doc ci-dessus (arbitrage Q2 de la
  // 6.4). C'est la SEULE différence de fond avec `normaliserLogo`, et elle est délibérée :
  // R15 attend des sources plus GRANDES, pas plus petites.
  return poserFichier(contenu, EXTENSION_PAR_FORMAT[analyse.image.format], volume.base);
}

// ══════════════════════════════════════════════════════════════════════════════════════
// 🔢 FACTEURS COMMUNS — EXTRAITS AU 2ᵉ CONSOMMATEUR, ET LE COMPTE EST ÉCRIT (Story 6.5)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// La leçon de R9 est « toujours COMPTER », pas « ne jamais dupliquer ». Compte réel entre
// `ecrireMedia` (6.4) et `normaliserLogo` (6.5) :
//
//   ① lecture des métadonnées + « ce n'est pas une image »          → identique  2/2
//   ② refus EXPLICITE du SVG                                        → identique  2/2
//   ③ liste blanche de format (et le cas `heif`/`compression`)      → identique  2/2
//   ④ dimensions absentes ⇒ illisible, puis plafond de pixels       → identique  2/2 *
//   ⑤ résolution du volume + existence, sans jamais le créer        → identique  2/2
//   ⑥ nom généré, garde de préfixe, écriture en `wx`                → identique  2/2
//   ⑦ ce qui est écrit, et sous quelle extension                    → DIFFÈRE    0/2
//
//   * le PLAFOND diffère (100 Mpx pour une photo, 40 pour un logo), pas la règle : il est
//     donc devenu un paramètre, pas une seconde copie du test.
//
// ⇒ Six étapes sur sept sont payées deux fois à l'identique. C'est le seuil de la doctrine,
// et l'extraction est faite ici plutôt que dans un module « utilitaire » : ces fonctions
// n'ont de sens que pour ce module, qui reste **la seule porte entre une valeur de base et
// le système de fichiers**.
//
// ⚠️ `ecrireMedia` est sous porte (`gate:galerie`). Ce remaniement ne change AUCUN de ses
// comportements observables — même ordre de refus, mêmes motifs, même nom généré. La porte
// est rejouée pour le prouver, pas pour le supposer.

type ImageAnalysee = { format: FormatAccepte; largeur: number; hauteur: number };

/**
 * Le CONTENU décide, et lui seul. Ne touche jamais au disque.
 *
 * 🔴 LE TYPE VIENT DU CONTENU, JAMAIS DU NOM NI DU `Content-Type` ANNONCÉ. Un fichier
 * `photo.png` contenant du texte est refusé ; un exécutable renommé `.jpg` aussi.
 *
 * 🔴 LE SVG EST REFUSÉ **EXPLICITEMENT**, ET CE N'EST PAS UN EFFET DE BORD. `sharp` SAIT
 * lire le SVG (mesuré : `format: "svg"`, dimensions rendues). Un refus qu'on déduirait d'un
 * échec de `sharp` ne refuserait donc RIEN. Or un SVG servi depuis notre propre origine
 * exécute son `<script>` dans le contexte du site : XSS stocké.
 * ⚠️ Story 6.5 : c'est le refus que les LOGOS vont rencontrer le plus souvent — un kit de
 * marque envoyé par un sponsor est presque toujours un SVG. Le refus ne change pas ; le
 * MESSAGE, lui, doit proposer une sortie (voir `actions/partenaires.ts`).
 *
 * @param pixelsMax plafond propre à l'appelant — voir `PIXELS_MAX` et `PIXELS_MAX_LOGO`.
 */
async function analyserImage(
  contenu: Buffer,
  pixelsMax: number,
): Promise<{ ok: true; image: ImageAnalysee } | { ok: false; echec: EchecMedia }> {
  let metadonnees;
  try {
    metadonnees = await sharp(contenu).metadata();
  } catch {
    // « Input buffer contains unsupported image format », « Input Buffer is empty »… :
    // dans tous les cas, ce n'est pas une image.
    return { ok: false, echec: { motif: "illisible" } };
  }

  if (metadonnees.format === "svg") return { ok: false, echec: { motif: "svg" } };

  const format = normaliserFormat(metadonnees.format, metadonnees.compression);
  if (format === null) {
    return { ok: false, echec: { motif: "format", format: metadonnees.format ?? "inconnu" } };
  }

  // Voir `PIXELS_MAX` : le poids du fichier ne borne PAS les dimensions.
  // ⚠️ Des dimensions absentes des métadonnées sont traitées comme un contenu illisible :
  // une image dont on ne sait pas la taille est une image qu'on ne sait pas servir.
  const largeur = metadonnees.width;
  const hauteur = metadonnees.height;
  if (typeof largeur !== "number" || typeof hauteur !== "number") {
    return { ok: false, echec: { motif: "illisible" } };
  }
  if (largeur * hauteur > pixelsMax) {
    return { ok: false, echec: { motif: "dimensions", largeur, hauteur } };
  }

  return { ok: true, image: { format, largeur, hauteur } };
}

/**
 * Le volume doit EXISTER, et on ne le crée jamais.
 *
 * 🔴 AUCUNE CRÉATION AUTOMATIQUE (`mkdir -p`), ET C'EST DÉLIBÉRÉ. Un `MEDIA_DIR` mal
 * orthographié qui se créerait tout seul produirait le mode de défaillance « tout réussit,
 * rien ne fonctionne » : les téléversements sembleraient marcher, et les fichiers seraient
 * écrits à côté du volume Docker sauvegardé. C'est très exactement R21 (la base `vitrine`
 * créée à la main) et le montage Docker corrigé par la 4.3.
 */
function resoudreVolume(): { ok: true; base: string } | { ok: false; echec: EchecMedia } {
  let base: string;
  try {
    base = racine();
  } catch {
    return { ok: false, echec: { motif: "volume" } };
  }
  if (!existsSync(base)) return { ok: false, echec: { motif: "volume" } };
  return { ok: true, base };
}

/**
 * Pose un fichier sous un nom **généré par le serveur**.
 *
 * 🔴 LE NOM SE JETTE, IL NE SE « NETTOIE » PAS — raisonnement complet en tête de cette
 * section. `randomUUID()` satisfait la liste blanche par construction.
 */
async function poserFichier(
  contenu: Buffer,
  extension: string,
  base: string,
): Promise<EcritureMedia> {
  const filename = `${randomUUID()}.${extension}`;
  const chemin = path.resolve(base, filename);
  // Défense en profondeur, au même titre que dans `ouvrirMedia` : le nom est fabriqué ici,
  // donc cette garde ne peut pas tirer aujourd'hui. Elle tiendra le jour où quelqu'un
  // changera la fabrique.
  if (!chemin.startsWith(base + path.sep)) return { ok: false, echec: { motif: "ecriture" } };

  try {
    // ⚠️ `wx` : ÉCHOUE si le fichier existe déjà, au lieu d'écraser en silence. Une
    // collision d'UUID v4 est hors d'atteinte en pratique, mais « écraser un fichier
    // existant » n'est pas un mode de défaillance qu'on veut rendre possible du tout —
    // l'autre ligne continuerait de pointer sur un fichier qui n'est plus le sien.
    await writeFile(chemin, contenu, { flag: "wx" });
  } catch (erreur) {
    console.error("[medias] Échec de l'écriture du média :", erreur);
    return { ok: false, echec: { motif: "ecriture" } };
  }

  return { ok: true, filename };
}

// ══════════════════════════════════════════════════════════════════════════════════════
// NORMALISATION DES LOGOS (Story 6.5) — LA PREMIÈRE ÉCRITURE QUI **TRANSFORME**
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 PLAFOND DE PIXELS PROPRE AUX LOGOS, ET IL EST PLUS BAS QUE CELUI DES PHOTOS.
 *
 * `PIXELS_MAX` (100 Mpx) protège d'un fichier **anormal** — il est calibré pour ne gêner
 * aucun appareil photo réel, parce que la galerie conserve l'original et que R15 attend des
 * sources haute définition.
 *
 * Ici le raisonnement s'inverse pour deux raisons :
 *   ① un logo n'est jamais une image d'appareil photo. 40 Mpx, c'est déjà 6300 × 6300 —
 *      très au-delà de tout kit de marque ;
 *   ② 🔴 ET SURTOUT : cette fonction **DÉCODE RÉELLEMENT** les pixels (`resize`), là où
 *      `ecrireMedia` se contente de lire un en-tête. Un PNG de 100 Mpx, c'est ~400 Mo en
 *      RGBA dans le processus, pour produire une vignette de 96 px de haut. Le plafond
 *      n'est donc plus seulement une garde de cohérence, c'est une garde de MÉMOIRE.
 */
const PIXELS_MAX_LOGO = 40_000_000;

export type NormalisationLogo =
  | {
      ok: true;
      filename: string;
      /** Dimensions du fichier RÉELLEMENT écrit. */
      largeur: number;
      hauteur: number;
      /**
       * 🔴 La source était plus PETITE que la hauteur canonique, donc elle n'a **pas** été
       * agrandie et la tuile ne sera pas uniforme.
       *
       * ⚠️ CE N'EST PAS UN ÉCHEC, C'EST UN FAIT À DIRE. Agrandir un logo de 40 px à 96 ne
       * fabriquerait aucun détail : le rendu serait visiblement mou et le bénévole ne
       * saurait pas pourquoi. Doctrine de la dette **R23**, appliquée telle quelle :
       * **avertir, jamais corriger dans le dos**. L'écran affiche cette information ; c'est
       * la seule chose que ce booléen existe pour rendre possible.
       */
      plusPetitQueLaBoite: boolean;
      /**
       * 🔴 LE FICHIER PRODUIT EST UN **FILET** — DÉFAUT TROUVÉ EN REVUE (Edge Case Hunter),
       * PUIS MESURÉ, ET IL EST PLUS LARGE QUE CE QUE LE RAPPORT DÉCRIVAIT.
       *
       * Le rapport signalait le cas MIROIR de la bannière : `96 × 4000 → 2 × 96`, un trait de
       * 2 pixels de large, sans aucun avertissement. Vrai. Mais la mesure a montré que **le
       * cas dont cette story est la plus fière produit exactement le même défaut** :
       *
       *   source 4000 × 96 → fichier 380 × 9  → rendu dans la tuile ≈ 190 × 4,5 px
       *   source 96 × 4000 → fichier 2 × 96   → rendu dans la tuile ≈ 1,2 × 56 px
       *   source 331 × 96  → fichier 331 × 96 → rendu ≈ 190 × 55 px   (logo réel, sain)
       *
       * Borner la LARGEUR empêchait le fichier de rester énorme ; ça n'a jamais empêché un
       * **rendu illisible**. Et `plusPetitQueLaBoite` ne pouvait pas le voir : il ne compare
       * que la HAUTEUR de la source à la hauteur canonique.
       *
       * 🔴 LE TEST PORTE SUR LE FICHIER PRODUIT, PAS SUR LA GÉOMÉTRIE DE LA TUILE — et c'est
       * délibéré. Écrire ici la boîte utile du rendu (190 × 56, dérivée du `max-width: 210px`
       * et du `height: 76px` moins l'`inset` de 10px) en ferait une **TROISIÈME copie** de la
       * géométrie que la dette **R27** compte à deux, et que cette même story vient de fermer
       * comme acceptée. La plus petite dimension du fichier normalisé suffit : elle est une
       * propriété de la boîte canonique, pas du rendu.
       */
      filet: boolean;
    }
  | { ok: false; echec: EchecMedia };

/**
 * Plancher de lisibilité, sur la plus petite dimension du fichier PRODUIT.
 *
 * 24 px, soit un quart de `LOGO_HAUTEUR` : en dessous, le logo occupe moins d'un quart de la
 * hauteur de la tuile, ce qui n'est plus une marque mais un trait. Valeurs mesurées :
 *   380 × 9 → 9 ⚠️ · 2 × 96 → 2 ⚠️ · 138 × 40 → 40 ✅ · 331 × 96 → 96 ✅ · 96 × 96 → 96 ✅
 *
 * ⚠️ ON AVERTIT, ON NE REFUSE PAS — doctrine **R23**, la même que `plusPetitQueLaBoite` :
 * refuser bloquerait un logo légitime quoique bizarre, et un bénévole n'aurait aucun moyen de
 * comprendre pourquoi. Les deux avertissements sont **distincts** et portent deux faits
 * différents (« trop petit » vs « trop étiré ») : ils ne se fondent pas en un seul booléen.
 */
const FILET_PLANCHER_PX = 24;

/**
 * Normalise un logo dans la **boîte canonique** et l'écrit sur le volume.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 `fit: "inside"` + LES **DEUX** DIMENSIONS BORNÉES — LA SECONDE EST CELLE QU'ON OUBLIE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * MESURÉ avec la version réellement installée (`sharp@0.34.5`) :
 *
 *     4000 × 96   →  resize({ height: 96, fit: "inside" })          →  4000 × 96  ⚠️
 *     4000 × 96   →  resize({ width: 380, height: 96, ... })        →   380 × 9   ✅
 *     1000 × 1000 →  resize({ width: 380, height: 96, ... })        →    96 × 96  ✅
 *      331 × 96   →  resize({ width: 380, height: 96, ... })        →   331 × 96  ✅ (no-op)
 *      138 × 40   →  resize({ ..., withoutEnlargement: true })      →   138 × 40  ✅ (non agrandi)
 *
 * Une contrainte qui ne porte que sur la hauteur laisse donc passer une bannière **intacte**,
 * avec son poids d'origine, pour un rendu de 4,5 px de haut dans la tuile. ⚠️ Et **aucune
 * porte de ce projet ne le verrait** — ni `gate` (`overflow-x: clip` rogne en silence), ni
 * Lighthouse, ni le contraste. Seul un œil, une fois en production.
 *
 * 🔴 `fit: "inside"` GARANTIT LE RAPPORT D'ASPECT — c'est l'exigence littérale de l'AC :
 * *« sans jamais être déformé »*. `cover` recadrerait, `fill` étirerait : les deux
 * mutileraient une marque tierce. La garde de RENDU (tuile à hauteur fixe +
 * `object-fit: contain`, garde-fou H de la 4.1) reste en place — les deux ne protègent pas
 * au même endroit, et cette story n'en remplace aucune.
 *
 * 🔴 SORTIE **WEBP**, TRANSPARENCE CONSERVÉE. Les quatre logos réels du projet portent tous
 * un canal alpha, et deux d'entre eux sont BLANCS : un aplat opaque les rendrait invisibles
 * sur `--navy`. C'est le défaut que le seed documente déjà (« les deux logos blancs sont
 * invisibles sur fond clair »), et il serait ici irréversible — le fichier d'origine n'est
 * pas conservé.
 */
export async function normaliserLogo(contenu: Buffer): Promise<NormalisationLogo> {
  // ── ① Le contenu décide, avec le plafond des logos ─────────────────────────────────
  const analyse = await analyserImage(contenu, PIXELS_MAX_LOGO);
  if (!analyse.ok) return { ok: false, echec: analyse.echec };

  // ── ② Le volume doit exister AVANT qu'on dépense un décodage ───────────────────────
  // L'ordre compte : ré-encoder puis découvrir que `MEDIA_DIR` est absente, c'est payer un
  // décodage pour rien — et surtout, c'est un refus qui arriverait APRÈS une transformation,
  // donc plus tard qu'il ne pouvait.
  const volume = resoudreVolume();
  if (!volume.ok) return { ok: false, echec: volume.echec };

  // ── ③ La transformation ────────────────────────────────────────────────────────────
  let normalise: Buffer;
  let sortie: { width: number; height: number };
  try {
    const resultat = await sharp(contenu)
      .resize({
        width: LOGO_LARGEUR_MAX,
        height: LOGO_HAUTEUR,
        fit: "inside",
        // 🔴 ON N'AGRANDIT JAMAIS — voir `plusPetitQueLaBoite`.
        withoutEnlargement: true,
      })
      // `alphaQuality` par défaut (100) : le canal alpha n'est pas dégradé. C'est lui qui
      // porte la découpe du logo, pas un détail de compression.
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    normalise = resultat.data;
    sortie = { width: resultat.info.width, height: resultat.info.height };
  } catch (erreur) {
    // Le contenu a franchi `analyserImage` (donc `sharp` sait le lire), mais le décodage
    // complet peut encore échouer : fichier tronqué dont l'en-tête est intact, mémoire
    // insuffisante… Le message rendu au bénévole reste celui de l'écriture — de son point
    // de vue, rien n'a été conservé, et il peut réessayer.
    console.error("[medias] Échec de la normalisation du logo :", erreur);
    return { ok: false, echec: { motif: "ecriture" } };
  }

  // ── ④ Le nom vient du serveur, l'extension est TOUJOURS webp ───────────────────────
  const ecriture = await poserFichier(normalise, LOGO_EXTENSION, volume.base);
  if (!ecriture.ok) return { ok: false, echec: ecriture.echec };

  return {
    ok: true,
    filename: ecriture.filename,
    largeur: sortie.width,
    hauteur: sortie.height,
    // Comparaison sur la HAUTEUR seule : c'est elle qui fait l'alignement du bandeau. Une
    // source large mais assez haute n'a rien d'anormal — c'est le cas de trois des quatre
    // logos réels.
    plusPetitQueLaBoite: analyse.image.hauteur < LOGO_HAUTEUR,
    // Voir `FILET_PLANCHER_PX` : le test porte sur le fichier PRODUIT, jamais sur la source.
    // Une source 4000 × 96 est parfaitement saine en soi ; c'est ce qu'elle DEVIENT dans la
    // boîte canonique qui est illisible.
    filet: Math.min(sortie.width, sortie.height) < FILET_PLANCHER_PX,
  };
}

/**
 * Ramène le `format` de sharp à l'un des formats acceptés, ou `null`.
 *
 * ⚠️ `heif` est le SEUL cas où `format` ne suffit pas : il couvre AVIF (`av1`) et HEIC
 * (`hevc`). Voir le commentaire de `FORMATS_ACCEPTES` — c'est un fait mesuré, pas une
 * précaution.
 */
function normaliserFormat(
  format: string | undefined,
  compression: string | undefined,
): FormatAccepte | null {
  if (format === "heif") return compression === "av1" ? "avif" : null;
  return (FORMATS_ACCEPTES as readonly string[]).includes(format ?? "")
    ? (format as FormatAccepte)
    : null;
}

/**
 * Supprime un média du volume. **Ne jette jamais.**
 *
 * 🔴 L'ORDRE D'APPEL EST UNE DÉCISION DE L'APPELANT, ET ELLE EST ÉCRITE DANS
 * `server/actions/galerie.ts` : la LIGNE d'abord, le FICHIER ensuite. Si la seconde étape
 * échoue, il reste un octet orphelin sur le volume — invisible du public. L'ordre inverse
 * laisserait une ligne pointant sur rien, c'est-à-dire un cadre cassé sur la page d'accueil.
 * On préfère perdre l'octet.
 *
 * @param nomValideEnBase nom **relu en base**, comme pour `ouvrirMedia`. Les mêmes gardes
 *   sont rejouées ici (basename, préfixe résolu) : ce module reste la seule porte vers le
 *   système de fichiers, et il ne fait pas confiance à ses appelants.
 * @returns `true` si le fichier n'est plus là (supprimé, ou déjà absent — le résultat
 *   voulu est atteint dans les deux cas), `false` si la suppression a échoué.
 */
export async function supprimerMedia(nomValideEnBase: string): Promise<boolean> {
  const nom = path.basename(nomValideEnBase);
  if (nom !== nomValideEnBase) return false;

  let base: string;
  try {
    base = racine();
  } catch {
    return false;
  }

  const chemin = path.resolve(base, nom);
  if (!chemin.startsWith(base + path.sep)) return false;

  try {
    await unlink(chemin);
    return true;
  } catch (erreur) {
    // ENOENT : le fichier n'existe déjà plus. La base et le volume peuvent diverger
    // (restauration partielle, sauvegarde base sans médias) — c'est le cas que
    // `ouvrirMedia` documente déjà. L'objectif « ce fichier n'est plus servi » est atteint.
    if ((erreur as NodeJS.ErrnoException).code === "ENOENT") return true;
    console.error("[medias] Échec de la suppression du média :", erreur);
    return false;
  }
}
