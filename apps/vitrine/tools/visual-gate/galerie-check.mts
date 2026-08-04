// 🔬 GARDE DE LA SURFACE « GALERIE » (Story 6.4) — 13ᵉ instrument du projet.
//
// Pourquoi un contrôle dédié — et cette fois une colonne de plus, parce que cette story est
// la PREMIÈRE DU PROJET À ÉCRIRE SUR UN DISQUE :
//
//   défaut possible                                                  lint/build Lighthouse gate œil
//   une route de galerie accessible sans session                         ❌        ❌      ❌  ⚠️
//   la page est RENDUE puis redirigée → un BROUILLON a fui               ❌        ❌      ❌  ❌
//   l'IMAGE d'un brouillon servie sans session                           ❌        ❌      ❌  ❌
//   un SVG accepté → XSS stocké servi depuis notre origine               ❌        ❌      ❌  ❌
//   un fichier renommé `.png` accepté sur la foi de son extension        ❌        ❌      ❌  ❌
//   une écriture REFUSÉE qui laisse quand même des octets sur le volume  ❌        ❌      ❌  ❌
//   `alt` borné dans Zod et PAS dans la base (asymétrie de la 4.3)       ❌        ❌      ❌  ❌
//   le nom stocké dérivé du nom fourni par le navigateur                 ❌        ❌      ❌  ❌
//
// 🔴 DEUX MOITIÉS, PARCE QUE LES DEUX RISQUES NE SE MESURENT PAS AU MÊME ENDROIT :
//   A — HTTP NU, sans aucun cookie : ce que le serveur SERT à un inconnu ;
//   B — ÉCRITURES QUI DOIVENT ÉCHOUER, contre la base ET le volume réels.
//
// 🔴 LA GARDE PROPRE À CETTE STORY EST LE **DÉCOMPTE DES FICHIERS DU VOLUME**. Toutes les
// autres portes du projet mesurent une réponse ou une valeur ; celle-ci mesure un EFFET DE
// BORD sur un disque. « Une écriture refusée ne laisse aucun octet » ne se lit dans aucune
// réponse HTTP : il faut compter les fichiers avant, et recompter après.
//
// 🔴 ÉCRITE EN TypeScript ET EXÉCUTÉE PAR `tsx`, comme `gate:agenda` et pour la même raison :
// la moitié B doit exercer `photoInputSchema` et `ecrireMedia` EUX-MÊMES. Une porte qui
// réimplémenterait leurs règles en JS validerait sa propre copie et resterait verte le jour
// où le produit divergerait — c'est `pieges/garde-nominale.md` (« vérifier un NOM ne protège
// pas un CONTRAT »).
//
// ⚠️ La moitié B écrit dans la base et le volume de DÉVELOPPEMENT. Chaque écriture en base
// vit dans une transaction ROLLBACK ; chaque fichier réellement écrit est retiré par la porte
// elle-même, et le décompte final le VÉRIFIE.
//
// 🔴 ET ELLE S'EXÉCUTE AVEC `--conditions=react-server` — SANS QUOI ELLE NE DÉMARRE PAS.
// MESURÉ le 2026-08-03 : `src/server/medias/` commence par `import "server-only"`, et ce
// paquet **LÈVE** hors du graphe serveur de React (« This module cannot be imported from a
// Client Component module »). Son `package.json` expose un module VIDE sous la condition
// `react-server` : c'est ainsi que Next le neutralise côté serveur, et c'est la seule façon
// honnête de l'exercer depuis une porte.
// ⚠️ L'issue facile aurait été de recopier la logique d'`ecrireMedia` dans cette porte. Elle
// aurait validé sa propre copie, et serait restée VERTE le jour où le produit divergerait —
// `pieges/garde-nominale.md`. On exerce le module réel, ou on ne mesure rien.
//
// Usage :  pnpm --filter vitrine gate:galerie [baseUrl]
//          GALERIE_AUTOTEST=1 …  → auto-validation de l'instrument
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import postgres from "postgres";
import sharp from "sharp";

import { BASE as BASE_DEFAUT } from "./config.mjs";
import { ALT_MAX, ALT_MIN, CAPTION_MAX, photoInputSchema } from "../../src/lib/schemas/photo";

const BASE = process.argv[2] ?? BASE_DEFAUT;
const AUTOTEST = process.env.GALERIE_AUTOTEST === "1";

const echecs: string[] = [];
const succes: string[] = [];
const exemptions = new Set<string>();
const ko = (garde: string, ou: string, quoi: string) => echecs.push(`${garde} ${ou} — ${quoi}`);
const ok = (garde: string, ou: string, quoi: string) => succes.push(`${garde} ${ou} — ${quoi}`);

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE_APP = join(ICI, "..", "..");

// ══════════════════════════════════════════════════════════════════════════════════════
// MOITIÉ A — HTTP NU, SANS AUCUN COOKIE
// ══════════════════════════════════════════════════════════════════════════════════════

/** Un UUID valide, mais qui ne désigne rien : la garde porte sur la ROUTE, pas sur la donnée. */
const UUID_QUELCONQUE = "00000000-0000-4000-8000-000000000000";

const ROUTES_GALERIE = [
  "/admin/galerie",
  "/admin/galerie/nouveau",
  "/admin/galerie/apercu",
  `/admin/galerie/${UUID_QUELCONQUE}`,
];

// En autotest, on présente à la porte une route qu'on SAIT ouverte comme si elle devait être
// protégée. Si les gardes sont réelles, elles échouent. Si elles restent vertes, l'instrument
// ne mesure rien et il ne faut pas se fier à ses verdicts.
const ROUTES_EPROUVEES = AUTOTEST ? ["/admin/login"] : ROUTES_GALERIE;

/** Marqueurs de contenu d'ADMINISTRATION — resserrés sur du CONTENU, jamais sur un titre.
 *  ⚠️ Leçon de `gate:admin` : le marqueur « Back-office » apparaît DEUX FOIS dans une
 *  redirection parfaitement propre (le `<title>` et son double dans la charge de
 *  métadonnées — Next évalue les `metadata` même quand le rendu s'interrompt). Un marqueur
 *  pris sur un titre rendrait donc la porte rouge sur un comportement correct. */
const MARQUEURS_ADMIN = [
  "Se déconnecter",
  "Sections du back-office",
  "Téléverser des photos",
  "L&#x27;accueil ne montre que les",
  "galerie-module__",
];

async function demander(chemin: string) {
  const reponse = await fetch(BASE + chemin, { redirect: "manual" });
  return {
    statut: reponse.status,
    emplacement: reponse.headers.get("location"),
    corps: await reponse.text(),
    octets: Number(reponse.headers.get("content-length") ?? "0"),
    typeMime: reponse.headers.get("content-type") ?? "",
  };
}

const estRedirection = (statut: number) => statut >= 300 && statut < 400;
const versLogin = (emplacement: string | null) =>
  typeof emplacement === "string" && emplacement.includes("/admin/login");

console.log(`\n🔎 Surface « galerie » — ${BASE}`);
if (AUTOTEST) {
  console.log("   ⚙️  MODE AUTO-VALIDATION : on présente à chaque garde un cas qu'elle DOIT voir.");
}
console.log();

for (const route of ROUTES_EPROUVEES) {
  const r = await demander(route);

  if (!estRedirection(r.statut) || !versLogin(r.emplacement)) {
    ko("① route gardée", route, `statut ${r.statut} → ${r.emplacement} au lieu de /admin/login`);
  } else {
    ok("① route gardée", route, `${r.statut} → ${r.emplacement}`);
  }

  const fuite = MARQUEURS_ADMIN.filter((m) => r.corps.includes(m));
  if (fuite.length > 0) {
    ko("② non-fuite", route, `le corps servi contient ${fuite.map((f) => `« ${f} »`).join(", ")}`);
  } else {
    ok("② non-fuite", route, `aucun contenu d'administration servi (${r.corps.length} o)`);
  }
}

// ── ⑭  LES MÉDIAS D'ADMIN NE TRANSITENT JAMAIS PAR L'OPTIMISEUR D'IMAGES ────────────
//
// 🔴 GARDE NÉE DU GATE VISUEL DE BRICE : **aucune vignette d'administration ne s'affichait**,
// et rien d'autre ne l'avait vu — ni lint, ni typecheck, ni build, ni les 12 autres portes,
// ni Lighthouse (qui n'audite que les 5 pages PUBLIQUES). Même famille que la régression du
// logo EDS en 4.3 : une image cassée n'est ni un débordement, ni un défaut de contraste.
//
// MESURE QUI A TRANCHÉ — les deux `400` de l'optimiseur ne disent pas la même chose :
//   · chemin hors `localPatterns` → « "url" parameter is not allowed »
//   · /admin/medias/…             → « The requested resource isn't a valid image. »
// Le motif était donc ACCEPTÉ ; ce qui échouait, c'est la récupération. L'optimiseur requête
// **depuis le serveur, sans cookie de session** ⇒ il reçoit le `307` de la garde.
//
// ⇒ Le contrat, désormais : `/admin/medias/**` est **hors** de `localPatterns`, les écrans
// d'admin servent en `unoptimized`, et l'optimiseur doit REFUSER ce chemin **au motif du
// MOTIF** — c'est ce que cette garde vérifie. Elle empêche deux régressions d'un coup :
// remettre l'entrée (qui ne marcherait pas et rendrait à nouveau des cadres cassés), et
// laisser une variante optimisée d'un BROUILLON s'écrire dans `.next/cache/images`.
{
  const cible = encodeURIComponent("/admin/medias/quelconque.avif");
  // En autotest on interroge un chemin PUBLIC, qui lui doit être autorisé : si la garde
  // reste verte, c'est qu'elle ne lit pas vraiment le motif de refus.
  const url = AUTOTEST
    ? `/_next/image?url=${encodeURIComponent("/medias/quelconque.avif")}&w=256&q=75`
    : `/_next/image?url=${cible}&w=256&q=75`;

  const r = await demander(url);
  const refuseParLeMotif = r.statut === 400 && r.corps.includes("is not allowed");

  if (!refuseParLeMotif) {
    ko(
      "⑭ médias d'admin non optimisables",
      "/_next/image?url=/admin/medias/…",
      `statut ${r.statut}, corps « ${r.corps.slice(0, 60)} » — attendu un refus PAR LE MOTIF ` +
        "(« url parameter is not allowed »). Un autre message signifie que le chemin est de " +
        "nouveau dans `localPatterns` : les vignettes d'admin rendront des cadres cassés, et " +
        "un brouillon pourra atterrir dans le cache d'images.",
    );
  } else {
    ok(
      "⑭ médias d'admin non optimisables",
      "/_next/image?url=/admin/medias/…",
      "400 « url parameter is not allowed » — hors localPatterns, comme voulu",
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// BASE ET VOLUME DE DÉVELOPPEMENT
// ══════════════════════════════════════════════════════════════════════════════════════

function lireVariable(nom: string): string | null {
  if (process.env[nom]) return process.env[nom]!;
  try {
    const contenu = readFileSync(join(RACINE_APP, ".env.local"), "utf8");
    const ligne = contenu.split(/\r?\n/).find((l) => l.trim().startsWith(`${nom}=`));
    return ligne ? ligne.slice(ligne.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

const urlBase = lireVariable("DATABASE_URL");
if (!urlBase) {
  console.log("🔴 DATABASE_URL introuvable — la moitié B ne peut pas s'exécuter.");
  console.log("   Démarrez le Postgres de dev et renseignez apps/vitrine/.env.local.");
  process.exit(1);
}

const mediaDirBrut = lireVariable("MEDIA_DIR");
if (!mediaDirBrut) {
  console.log("🔴 MEDIA_DIR introuvable — le décompte de fichiers ne peut pas s'exécuter.");
  process.exit(1);
}
// `MEDIA_DIR` est relatif au cwd de l'application (`apps/vitrine`), pas à ce dossier d'outils.
const MEDIA_DIR = resolve(RACINE_APP, mediaDirBrut);

// 🔴 DÉFAUT D'INSTRUMENT N°1, TROUVÉ EN LE PROUVANT ROUGE : `server/medias` lit
// `process.env.MEDIA_DIR`, et cette porte n'est pas Next — personne n'a chargé `.env.local`
// dans son processus. `ecrireMedia` refusait donc TOUTE écriture avec le motif « volume »,
// y compris l'écriture nominale. L'instrument accusait le produit d'un défaut qui n'existait
// que dans l'instrument (`pieges/instrument-non-valide.md`, 10 occurrences sur ce projet,
// dont 3 de cette famille).
// ⚠️ On injecte la valeur ABSOLUE et non `./medias` : `racine()` la résout contre le cwd du
// processus, et le cwd d'une porte n'est pas garanti d'être `apps/vitrine`.
process.env.MEDIA_DIR = MEDIA_DIR;

const sql = postgres(urlBase, { max: 1, onnotice: () => {} });

/** Nombre de fichiers présents sur le volume — LE témoin propre à cette story. */
function compterFichiers(): number {
  if (!existsSync(MEDIA_DIR)) return -1;
  return readdirSync(MEDIA_DIR).length;
}

// ── ③  UNE ÉCRITURE REFUSÉE NE LAISSE AUCUN OCTET ────────────────────────────────────
// 🔴 LA GARDE CENTRALE DE CETTE STORY, ET LA SEULE QUI REGARDE LE DISQUE. Le défaut le plus
// facile à commettre est d'écrire d'abord et de valider ensuite : il laisserait sur le volume
// des fichiers qu'AUCUNE ligne ne référence, donc qu'aucun écran ne peut supprimer.
// ⚠️ On exerce `ecrireMedia` LUI-MÊME. L'import est dynamique pour que l'échec éventuel de
// `server-only` se produise ICI, avec un message lisible, plutôt qu'au chargement du module
// et avant la moindre ligne de sortie (voir l'en-tête : `--conditions=react-server`).
{
  const { ecrireMedia, supprimerMedia } = await import("../../src/server/medias/index");

  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">' +
      "<script>alert(1)</script><rect width=\"10\" height=\"10\"/></svg>",
  );
  const texte = Buffer.from("ceci n'est pas une image, mais le fichier s'appelait photo.png");
  const gif = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#29265B" } })
    .gif()
    .toBuffer();
  const vide = Buffer.alloc(0);
  const avif = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#29265B" } })
    .avif()
    .toBuffer();

  const aRefuser: { libelle: string; contenu: Buffer; motif: string }[] = [
    // 🔴 LE SVG EST LE CAS N°1, ET IL NE PEUT PAS ÊTRE DÉDUIT D'UN ÉCHEC : `sharp` SAIT lire
    // le SVG (mesuré : `format: "svg"`). Une porte qui se contenterait de vérifier « sharp a
    // échoué » ne verrait donc rien du tout.
    { libelle: "SVG (XSS stocké)", contenu: svg, motif: "svg" },
    { libelle: "texte brut renommé en image", contenu: texte, motif: "illisible" },
    { libelle: "buffer vide", contenu: vide, motif: "illisible" },
    { libelle: "GIF (format hors liste)", contenu: gif, motif: "format" },
    // 🔴 BOMBE DE DÉCOMPRESSION — garde ajoutée après revue. Un PNG d'aplat de couleur
    // annonçant 12 000 × 12 000 (144 Mpx) pèse quelques dizaines de kilo-octets : la borne de
    // POIDS du formulaire (10 Mo) ne le voit donc PAS. Sans plafond de pixels, il serait écrit
    // tel quel, et c'est `next/image` — ailleurs, plus tard — qui échouerait au décodage, en
    // rendant un cadre cassé que rien ne relierait à sa cause.
    {
      libelle: "PNG de 144 mégapixels (12 000 × 12 000)",
      contenu: await sharp({
        create: { width: 12000, height: 12000, channels: 3, background: "#29265B" },
      })
        .png({ compressionLevel: 9 })
        .toBuffer(),
      motif: "dimensions",
    },
  ];

  // En autotest, on ajoute une image PARFAITEMENT valide à la liste des « doivent être
  // refusées » : si la garde reste verte, elle ne mesure rien.
  const cas = AUTOTEST
    ? [...aRefuser, { libelle: "AUTOTEST — AVIF valide présenté comme devant échouer", contenu: avif, motif: "illisible" }]
    : aRefuser;

  for (const { libelle, contenu, motif } of cas) {
    const avant = compterFichiers();
    const resultat = await ecrireMedia(contenu);
    const apres = compterFichiers();

    if (resultat.ok) {
      ko("③ écriture refusée", libelle, `ACCEPTÉE, fichier écrit : ${resultat.filename}`);
      // On nettoie derrière soi même quand la porte est rouge : une porte ne doit pas laisser
      // le volume dans un état que la story suivante devra deviner.
      await supprimerMedia(resultat.filename);
      continue;
    }
    if (resultat.echec.motif !== motif) {
      ko("③ écriture refusée", libelle, `refusée pour « ${resultat.echec.motif} », attendu « ${motif} »`);
      continue;
    }
    if (apres !== avant) {
      ko(
        "④ aucun octet laissé",
        libelle,
        `le volume est passé de ${avant} à ${apres} fichiers alors que l'écriture a été REFUSÉE`,
      );
      continue;
    }
    ok("③ écriture refusée", libelle, `refusée (« ${resultat.echec.motif} »)`);
    ok("④ aucun octet laissé", libelle, `${avant} fichiers avant et après`);
  }

  // ── ⑤  L'ÉCRITURE NOMINALE, ET LE NOM QU'ELLE PRODUIT ──────────────────────────────
  // Contre-partie indispensable : une porte qui refuse tout ne mesure rien.
  const avant = compterFichiers();
  const nominal = await ecrireMedia(avif);
  if (!nominal.ok) {
    ko("⑤ écriture nominale", "AVIF valide", `REFUSÉE (« ${nominal.echec.motif} »)`);
  } else {
    const apres = compterFichiers();
    if (apres !== avant + 1) {
      ko("⑤ écriture nominale", "AVIF valide", `le volume est passé de ${avant} à ${apres}, +1 attendu`);
    } else {
      ok("⑤ écriture nominale", "AVIF valide", `écrit sous ${nominal.filename} (${avant} → ${apres})`);
    }

    // 🔴 LE NOM EST GÉNÉRÉ PAR LE SERVEUR, ET IL DOIT SATISFAIRE LA LISTE BLANCHE — celle de
    // Zod ET celle de la base, qui sont deux écritures de la même règle.
    const analyse = photoInputSchema.pick({ filename: true }).safeParse({
      filename: AUTOTEST ? "../../.env.local" : nominal.filename,
    });
    if (!analyse.success) {
      ko("⑥ nom conforme", nominal.filename, "REFUSÉ par `photoInputSchema.filename`");
    } else {
      ok("⑥ nom conforme", nominal.filename, "accepté par la liste blanche partagée");
    }

    // ⚠️ Le format AVIF est rendu `heif` par sharp : si la table de correspondance oubliait ce
    // cas, l'extension produite serait fausse (ou l'écriture refusée). Fait MESURÉ au cadrage,
    // et le cadrage de la story disait l'inverse — d'où cette garde.
    if (!nominal.filename.endsWith(".avif")) {
      ko("⑥ nom conforme", nominal.filename, "un AVIF n'a pas produit l'extension `.avif`");
    } else {
      ok("⑥ nom conforme", nominal.filename, "extension `.avif` déduite du CONTENU (sharp dit `heif`)");
    }

    // La porte nettoie derrière elle, et le VÉRIFIE.
    await supprimerMedia(nominal.filename);
    const final = compterFichiers();
    if (final !== avant) {
      ko("⑦ nettoyage", "après écriture nominale", `${final} fichiers au lieu de ${avant}`);
    } else {
      ok("⑦ nettoyage", "après écriture nominale", `volume rendu à ${final} fichiers`);
    }
  }
}

// ── ⑧  LA BASE REFUSE CE QUE ZOD REFUSE — écritures en SQL direct, hors de tout schéma ──
{
  const SENTINELLE = "ROLLBACK_VOULU_PAR_LA_PORTE";
  async function ecritureRefusee(requete: string): Promise<{ refusee: boolean; detail: string }> {
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(requete);
        throw new Error(SENTINELLE);
      });
      return { refusee: false, detail: "acceptée (transaction annulée)" };
    } catch (erreur) {
      const e = erreur as { message?: string; code?: string; constraint_name?: string };
      if (e.message === SENTINELLE) return { refusee: false, detail: "acceptée (transaction annulée)" };
      return { refusee: true, detail: `${e.code ?? "?"} ${e.constraint_name ?? ""}`.trim() };
    }
  }

  const INSERT = (filename: string, alt: string, colonnes = "", valeurs = "") =>
    `INSERT INTO photo (filename, alt${colonnes}) VALUES ('${filename}', ${alt}${valeurs})`;

  const aRefuser = [
    // 🔴 LE CAS QUI A MOTIVÉ LA MIGRATION `0008` : `alt` était borné à 300 dans Zod et PAS
    // dans la base. `caption` l'était des deux côtés depuis la 4.3 — l'asymétrie était juste
    // à côté de l'endroit où l'AC de la story regardait.
    { libelle: `alt de ${ALT_MAX + 1} caractères`, requete: INSERT("porte-galerie-01.avif", `repeat('a', ${ALT_MAX + 1})`) },
    { libelle: "alt blanc", requete: INSERT("porte-galerie-02.avif", `'   '`) },
    { libelle: `légende de ${CAPTION_MAX + 1} caractères`, requete: INSERT("porte-galerie-03.avif", `'Description correcte de la photo'`, ", caption", `, repeat('a', ${CAPTION_MAX + 1})`) },
    { libelle: "légende blanche", requete: INSERT("porte-galerie-04.avif", `'Description correcte de la photo'`, ", caption", `, '  '`) },
    // 🔴 `axjpg` — LE PIÈGE D'ÉCHAPPEMENT À DEUX ÉTAGES du `CHECK photo_filename_safe`. Écrit
    // `\.` au lieu de `\\.` dans le gabarit JS, le point serait devenu « n'importe quel
    // caractère » et ce nom passerait. Rien d'autre ne le verrait.
    { libelle: "nom `axjpg` (point non littéral)", requete: INSERT("axjpg", `'Description correcte de la photo'`) },
    { libelle: "nom avec traversée `../secret.png`", requete: INSERT("../secret.png", `'Description correcte de la photo'`) },
    { libelle: "nom en `.svg`", requete: INSERT("photo.svg", `'Description correcte de la photo'`) },
    { libelle: "nom en MAJUSCULES `PHOTO.PNG`", requete: INSERT("PHOTO.PNG", `'Description correcte de la photo'`) },
  ];

  const cas = AUTOTEST
    ? [...aRefuser, { libelle: "AUTOTEST — ligne VALIDE présentée comme devant échouer", requete: INSERT("porte-galerie-ok.avif", `'Description parfaitement correcte de la photo'`) }]
    : aRefuser;

  for (const { libelle, requete } of cas) {
    const { refusee, detail } = await ecritureRefusee(requete);
    if (!refusee) ko("⑧ la base refuse", libelle, `ACCEPTÉE par Postgres — ${detail}`);
    else ok("⑧ la base refuse", libelle, `refusée (${detail})`);
  }

  // Contre-partie : ce qui est valide DOIT passer — une porte qui refuse tout ne mesure rien.
  const aAccepter = [
    { libelle: `alt de ${ALT_MAX} caractères (la borne elle-même)`, requete: INSERT("porte-galerie-05.avif", `repeat('a', ${ALT_MAX})`) },
    { libelle: `légende de ${CAPTION_MAX} caractères (la borne elle-même)`, requete: INSERT("porte-galerie-06.avif", `'Description correcte de la photo'`, ", caption", `, repeat('a', ${CAPTION_MAX})`) },
    { libelle: "légende absente (NULL)", requete: INSERT("porte-galerie-07.avif", `'Description correcte de la photo'`) },
  ];
  for (const { libelle, requete } of aAccepter) {
    const { refusee, detail } = await ecritureRefusee(requete);
    if (refusee) ko("⑨ la base accepte", libelle, `REFUSÉE alors qu'elle est valide — ${detail}`);
    else ok("⑨ la base accepte", libelle, detail);
  }
}

// ── ⑩  ZOD REFUSE CE QUE LA BASE NE PEUT PAS VOIR ────────────────────────────────────
// 🔴 `btrim()` NE RETIRE PAS U+200B, ET LES NEUF CONTRAINTES DE LA `0006` ONT LA MÊME LIMITE
// (leçon 6.3, limite déclarée et assumée de la `0008`). C'est donc Zod, et lui seul, qui
// tient ce cas : si `visiblementVide` disparaissait de `photo.ts`, RIEN d'autre ne le verrait.
{
  const INVISIBLE = "\u200B\u200B\u200B"; // ÉCHAPPEMENTS EXPLICITES : en littéral ils seraient invisibles dans un éditeur, et un `git diff` ne montrerait rien.
  const cas = [
    {
      libelle: "alt fait de caractères invisibles",
      valeur: { filename: "porte.avif", alt: AUTOTEST ? "Une description parfaitement correcte" : INVISIBLE },
    },
    {
      libelle: `alt de ${ALT_MIN - 1} caractères (sous la borne basse)`,
      valeur: { filename: "porte.avif", alt: AUTOTEST ? "Une description parfaitement correcte" : "a".repeat(ALT_MIN - 1) },
    },
    {
      libelle: `alt de ${ALT_MAX + 1} caractères`,
      valeur: { filename: "porte.avif", alt: AUTOTEST ? "Une description parfaitement correcte" : "a".repeat(ALT_MAX + 1) },
    },
  ];

  for (const { libelle, valeur } of cas) {
    if (photoInputSchema.safeParse(valeur).success) {
      ko("⑩ Zod refuse", libelle, "ACCEPTÉ — un texte invisible n'est pas une description");
    } else {
      ok("⑩ Zod refuse", libelle, "refusé par Zod");
    }
  }
}

// ── ⑪  AUCUNE PHOTO NON PUBLIÉE NE DOIT ÊTRE SERVIE PAR LA ROUTE PUBLIQUE ────────────
//
// 🔴 DÉFAUT D'INSTRUMENT N°2 : LE PREMIER JET ÉTAIT UN FAUX VERT. La seule photo non publiée
// de la base de dev N'A PAS DE FICHIER sur le volume (mesuré : `brouillon-non-publie.avif`
// est en base, absent de `medias/`). Le 404 obtenu ne prouvait donc RIEN du filtre
// `is_published` — il prouvait que le fichier manquait, ce que la route fait de toute façon.
// ⇒ La porte ÉCRIT le fichier manquant avant de mesurer, et le retire après. C'est la seule
// façon de distinguer « refusé parce que non publié » de « absent du disque », et c'est
// exactement le témoin nominal que la 4.3 avait dû ajouter pour la même raison.
{
  const { supprimerMedia } = await import("../../src/server/medias/index");
  const { writeFileSync } = await import("node:fs");

  const brouillons = await sql<{ filename: string }[]>`
    SELECT filename FROM photo WHERE is_published = false LIMIT 20
  `;

  if (brouillons.length === 0) {
    exemptions.add(
      "Garde ⑪ (aucun brouillon servi) : la base de dev ne contient AUCUNE photo non publiée, " +
        "la garde n'a donc rien cherché. Elle est VIDE, pas verte.",
    );
  } else {
    const imageValide = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#29265B" },
    })
      .avif()
      .toBuffer();

    for (const { filename } of brouillons) {
      const avant = compterFichiers();
      const cheminTemoin = join(MEDIA_DIR, filename);
      let temoinPose = false;
      if (!existsSync(cheminTemoin)) {
        writeFileSync(cheminTemoin, imageValide);
        temoinPose = true;
      }

      const publique = await demander(`/medias/${filename}`);
      if (publique.statut !== 404) {
        ko(
          "⑪ brouillon non servi",
          `/medias/${filename}`,
          `statut ${publique.statut} au lieu de 404 — le fichier EXISTE, c'est donc le filtre ` +
            "`is_published` qui n'a pas tenu",
        );
      } else {
        ok(
          "⑪ brouillon non servi",
          `/medias/${filename}`,
          `404 alors que le FICHIER EXISTE (témoin ${temoinPose ? "posé" : "déjà présent"}) — c'est bien le filtre qui refuse`,
        );
      }

      // 🔴 DÉFAUT D'INSTRUMENT N°3, ET IL ACCUSAIT LE PRODUIT — 3ᵉ occurrence de cette
      // famille sur le projet. Le premier jet exigeait un 404 et rapportait « un octet
      // d'image a été servi sans session » sur un **307**. C'était faux deux fois : le
      // matcher `/admin/:path*` de `proxy.ts` redirige AVANT que la route ne s'exécute (donc
      // aucun octet n'a été servi), et une redirection vers la connexion est un refus
      // parfaitement correct. Ce qui compte n'est pas LE CODE, c'est qu'AUCUN OCTET D'IMAGE
      // ne sorte : la garde porte désormais sur ça, et accepte les deux refus.
      const admin = await demander(`/admin/medias/${filename}`);
      const refus =
        admin.statut === 404 || (estRedirection(admin.statut) && versLogin(admin.emplacement));
      if (!refus || admin.typeMime.startsWith("image/")) {
        ko(
          "⑫ route média d'admin gardée",
          `/admin/medias/${filename}`,
          `statut ${admin.statut}, type « ${admin.typeMime} » — un octet d'image a pu sortir sans session`,
        );
      } else {
        ok(
          "⑫ route média d'admin gardée",
          `/admin/medias/${filename}`,
          `${admin.statut} sans cookie, type « ${admin.typeMime || "aucun" } » — aucun octet d'image`,
        );
      }

      if (temoinPose) {
        await supprimerMedia(filename);
        const apres = compterFichiers();
        if (apres !== avant) {
          ko("⑬ nettoyage du témoin", filename, `${apres} fichiers au lieu de ${avant}`);
        } else {
          ok("⑬ nettoyage du témoin", filename, `volume rendu à ${apres} fichiers`);
        }
      }
    }

    // ⚠️ EXEMPTION HÉRITÉE ET RÉELLE : sans cookie, le proxy redirige avant la route, donc
    // cette porte ne peut PAS observer que `/admin/medias/[filename]` porte bien sa propre
    // garde `lireAdmin()`. La fuite serait structurellement inobservable ici — c'est la même
    // limite que `gate:admin` a déclarée pour les pages.
    exemptions.add(
      "🔴 QUE `/admin/medias/[filename]` PORTE SA PROPRE GARDE. Sans cookie, le proxy " +
        "redirige AVANT que la route ne s'exécute : la porte constate un refus, pas SA " +
        "PROVENANCE. Débrancher le matcher est le seul moyen de le mesurer, et c'est ce qui " +
        "a été fait à la main pendant la story — pas ce que cette porte rejoue.",
    );
  }
}

await sql.end();

// ══════════════════════════════════════════════════════════════════════════════════════

exemptions.add(
  "Le chemin AUTHENTIFIÉ (téléverser, décrire, ordonner, publier, supprimer une fois " +
    "connecté) — il exige un aller-retour Discord avec un humain. Aucune porte ne le remplacera.",
);
exemptions.add(
  "L'APPARENCE des écrans de galerie (ton, rythme, hiérarchie) — c'est le gate visuel de " +
    "Brice, et la passe 1 ne s'outille pas (rétro Epic 5).",
);
exemptions.add(
  "🔴 QU'UN `alt` SOIT PERTINENT. Cette porte vérifie qu'il existe, qu'il est assez long et " +
    "qu'il n'est pas invisible. Elle ne peut PAS voir qu'un bénévole y a recopié la légende — " +
    "et Lighthouse non plus, qui ne voit qu'un `alt` NON VIDE. C'est un point du gate ÉDITORIAL.",
);
exemptions.add(
  "Que la même IMAGE ne soit pas téléversée deux fois : `filename` est unique, le CONTENU ne " +
    "l'est pas. Ce n'est pas rattrapable par la base — c'est écrit à l'écran, pas gardé ici.",
);
exemptions.add(
  "Que chaque nouvelle page d'admin appelle bien sa PROPRE garde : sans cookie le proxy " +
    "redirige AVANT que la page ne s'exécute, la fuite est structurellement inobservable ici " +
    "(exemption héritée de `gate:admin`).",
);

console.log();
for (const s of succes) console.log("  ✅ " + s);
if (exemptions.size > 0) {
  console.log();
  console.log(`  ⚠️  ${exemptions.size} EXEMPTION(S) DÉCLARÉE(S) — cette porte NE les couvre PAS :`);
  for (const e of [...exemptions].sort()) console.log("     · " + e);
  console.log("     Une porte verte ne veut donc PAS dire « tout est couvert ».");
}
if (echecs.length > 0) {
  console.log();
  for (const e of echecs) console.log("  ❌ " + e);
}
console.log();

if (AUTOTEST) {
  if (echecs.length === 0) {
    console.log("🔴 AUTO-VALIDATION ÉCHOUÉE — chaque garde a reçu un cas qu'elle devait voir,");
    console.log("   et la porte reste verte. L'instrument ne mesure rien : ne pas s'y fier.");
    process.exit(1);
  }
  console.log(`✅ INSTRUMENT VALIDE — ${echecs.length} garde(s) ont vu le cas qu'on leur présentait.`);
  process.exit(0);
}

if (echecs.length > 0) {
  console.log(`🔴 ${echecs.length} GARDE(S) EN ÉCHEC.`);
  process.exit(1);
}
console.log(
  `✅ SURFACE GALERIE TENUE — ${succes.length} gardes : routes gardées et sans fuite (HTTP nu), ` +
    "écritures de fichiers refusées SANS laisser d'octet, contraintes de base éprouvées, " +
    "contrats Zod exercés, brouillons non servis.",
);
