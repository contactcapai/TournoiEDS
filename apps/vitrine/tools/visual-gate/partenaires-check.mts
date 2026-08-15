// @porte surface=partenaires effet=base+disque story=6.5
// 🔬 GARDE DE LA SURFACE « PARTENAIRES » (Story 6.5) — 14ᵉ instrument du projet.
//
// Pourquoi un contrôle dédié — et ce que RIEN d'autre ne voit :
//
//   défaut possible                                                  lint/build Lighthouse gate œil
//   une route de partenaires accessible sans session                     ❌        ❌      ❌  ⚠️
//   le LOGO d'un partenaire non publié servi sans session                ❌        ❌      ❌  ❌
//   🔴 un logo écrit sur le volume mais servi en 404 (fait ① du cadrage) ❌        ❌      ❌  ⚠️
//   🔴 une bannière 4000×96 traversant la normalisation INTACTE          ❌        ❌      ❌  ⚠️
//   un logo DÉFORMÉ (rapport d'aspect non conservé)                      ❌        ❌      ❌  ⚠️
//   un SVG accepté → XSS stocké servi depuis notre origine               ❌        ❌      ❌  ❌
//   une écriture REFUSÉE qui laisse quand même des octets sur le volume  ❌        ❌      ❌  ❌
//   un remplacement de logo qui laisse l'ANCIEN fichier orphelin         ❌        ❌      ❌  ❌
//   `partner` borné dans Zod et PAS dans la base (asymétrie du cadrage)  ❌        ❌      ❌  ❌
//   une valeur `/partenaires/…` prise pour un fichier du volume          ❌        ❌      ❌  ❌
//
// 🔴 DEUX MOITIÉS, PARCE QUE LES DEUX RISQUES NE SE MESURENT PAS AU MÊME ENDROIT :
//   A — HTTP NU, sans aucun cookie : ce que le serveur SERT à un inconnu ;
//   B — ÉCRITURES QUI DOIVENT ÉCHOUER + CONTRATS EXERCÉS, contre la base et le volume réels.
//
// 🔴 CE QUE CETTE PORTE AJOUTE À `gate:galerie` : la galerie CONSERVE l'original ; ici on le
// **RÉÉCRIT**. Mesurer « le fichier est bien arrivé » ne suffit donc plus — il faut mesurer
// **ce qu'il est devenu**. C'est la moitié B, gardes ⑨ à ⑫.
//
// 🔴 ÉCRITE EN TypeScript ET EXÉCUTÉE PAR `tsx`, comme `gate:agenda` et `gate:galerie`, et
// pour la même raison : la moitié B doit exercer `partnerInputSchema`, `normaliserLogo` et
// `lib/logos` EUX-MÊMES. Une porte qui réimplémenterait leurs règles validerait sa propre
// copie et resterait verte le jour où le produit divergerait (`pieges/garde-nominale.md`).
//
// 🔴 ET ELLE S'EXÉCUTE AVEC `--conditions=react-server` — SANS QUOI ELLE NE DÉMARRE PAS :
// `src/server/medias/` commence par `import "server-only"`, paquet qui LÈVE hors du graphe
// serveur de React. Mesuré en 6.4, repris tel quel.
//
// ⚠️ La moitié B écrit dans la base et le volume de DÉVELOPPEMENT. Chaque écriture en base
// vit dans une transaction ROLLBACK ; chaque fichier réellement écrit est retiré par la porte
// elle-même, et le décompte final le VÉRIFIE.
//
// Usage :  pnpm --filter vitrine gate:partenaires [baseUrl]
//          PARTENAIRES_AUTOTEST=1 …  → auto-validation de l'instrument
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import sharp from "sharp";

import { BASE as BASE_DEFAUT } from "./config.mjs";
import { lireVariable } from "./env.mjs";
import {
  cheminLogo,
  estLogoDuVolume,
  LOGO_HAUTEUR,
  LOGO_LARGEUR_MAX,
  nomFichierLogo,
  sourceLogo,
} from "../../src/lib/logos";
import {
  DESCRIPTION_MAX,
  LINK_MAX,
  NAME_MAX,
  partnerInputSchema,
} from "../../src/lib/schemas/partner";

const BASE = process.argv[2] ?? BASE_DEFAUT;
const AUTOTEST = process.env.PARTENAIRES_AUTOTEST === "1";

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

const ROUTES_PARTENAIRES = [
  "/admin/partenaires",
  "/admin/partenaires/nouveau",
  "/admin/partenaires/apercu",
  `/admin/partenaires/${UUID_QUELCONQUE}`,
];

// En autotest, on présente à la porte une route qu'on SAIT ouverte comme si elle devait être
// protégée. Si les gardes sont réelles, elles échouent. Si elles restent vertes, l'instrument
// ne mesure rien et il ne faut pas se fier à ses verdicts.
const ROUTES_EPROUVEES = AUTOTEST ? ["/admin/login"] : ROUTES_PARTENAIRES;

/** Marqueurs de contenu d'ADMINISTRATION — resserrés sur du CONTENU, jamais sur un titre.
 *  ⚠️ Leçon de `gate:admin` : un marqueur pris sur un `<title>` rendrait la porte rouge sur
 *  une redirection parfaitement propre (Next évalue les `metadata` même quand le rendu
 *  s'interrompt). */
const MARQUEURS_ADMIN = [
  "Se déconnecter",
  "Ajouter un partenaire",
  "Seuls les faits acquis ont leur place ici",
  "Dans le bandeau de l&#x27;accueil",
  "partenaires-module__",
];

async function demander(chemin: string) {
  const reponse = await fetch(BASE + chemin, { redirect: "manual" });
  return {
    statut: reponse.status,
    emplacement: reponse.headers.get("location"),
    corps: await reponse.text(),
    typeMime: reponse.headers.get("content-type") ?? "",
  };
}

const estRedirection = (statut: number) => statut >= 300 && statut < 400;
const versLogin = (emplacement: string | null) =>
  typeof emplacement === "string" && emplacement.includes("/admin/login");

console.log(`\n🔎 Surface « partenaires » — ${BASE}`);
if (AUTOTEST) {
  console.log("   ⚙️  MODE AUTO-VALIDATION : on présente à chaque garde un cas qu'elle DOIT voir.");
}
console.log();

// ── ①②  LES ROUTES D'ADMINISTRATION SONT GARDÉES, ET NE FUITENT RIEN ────────────────
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

// ── ③  LA ROUTE DE LOGOS D'ADMIN RÉPOND 404 SANS SESSION, JAMAIS 200 NI 500 ─────────
//
// 🔴 404 ET JAMAIS 403 : un 403 CONFIRMERAIT l'existence du nom, donc transformerait cette
// route en moyen d'énumérer les logos non publiés. L'absence et le refus doivent être
// indiscernables de l'extérieur.
{
  const chemin = AUTOTEST ? "/medias/logos/x.webp" : "/admin/medias/logos/x.webp";
  const r = await demander(chemin);
  // ⚠️ Le proxy peut rediriger AVANT la route (matcher `/admin/:path*`) : les deux réponses
  // sont acceptables tant qu'aucune IMAGE n'est servie. Ce qui est interdit, c'est un 200.
  if (r.statut === 200) {
    ko("③ logo d'admin", chemin, "200 SANS session — fuite d'un logo non publié");
  } else if (r.statut >= 500) {
    ko("③ logo d'admin", chemin, `${r.statut} — un 5xx distingue cette valeur des autres`);
  } else {
    ok("③ logo d'admin", chemin, `${r.statut}${r.emplacement ? ` → ${r.emplacement}` : ""}, aucune image servie`);
  }
}

// ── ④  TRAVERSÉES ET VALEURS BISCORNUES ⇒ 404, JAMAIS 500 ──────────────────────────
//
// 🔴 UN 500 EST UN TROISIÈME ÉTAT DE RÉPONSE, et c'est lui le vrai danger : il DISTINGUE une
// valeur d'une autre. Défaut mesuré en 4.3 sur `%00`, que le driver `postgres` refuse côté
// client — l'exception remontait non gérée et Next la transformait en 500.
const TRAVERSEES = [
  "../../.env.local",
  "..%2F..%2F.env.local",
  "x.webp%00.jpg",
  "%2e%2e%2f.env",
  "..\\..\\.env.local",
  "n-existe-pas.webp",
];
for (const valeur of TRAVERSEES) {
  const chemin = `/medias/logos/${valeur}`;
  const r = await demander(chemin);
  if (r.statut === 200) {
    ko("④ traversée", chemin, "200 — un fichier a été servi");
  } else if (r.statut >= 500) {
    ko("④ traversée", chemin, `${r.statut} — troisième état de réponse, il renseigne`);
  } else {
    ok("④ traversée", chemin, `${r.statut}, aucun fichier servi`);
  }
}

// ── ⑤  L'OPTIMISEUR REFUSE LES LOGOS D'ADMIN ────────────────────────────────────────
//
// 🔴 GARDE HÉRITÉE DU GATE VISUEL DE LA 6.4 : aucune ressource protégée par une session ne
// peut transiter par `/_next/image`, qui requête depuis le serveur SANS cookie. La parade est
// `unoptimized` + l'ABSENCE de `/admin/medias/**` dans `images.localPatterns`.
// ⚠️ On vérifie que ce chemin reste REFUSÉ : si quelqu'un l'ajoutait à `localPatterns`, il
// obtiendrait un 400 différent (« resource isn't a valid image ») et croirait avoir corrigé
// quelque chose. C'est le CORPS qui discrimine, pas le code (leçon ① de la 6.4).
{
  const chemin = `/_next/image?url=${encodeURIComponent("/admin/medias/logos/x.webp")}&w=256&q=75`;
  const r = await demander(chemin);
  const refusParLeMotif = r.corps.includes('"url" parameter is not allowed');
  if (r.statut === 200) {
    ko("⑤ optimiseur", "/admin/medias/logos/**", "200 — une ressource gardée a été optimisée");
  } else if (!refusParLeMotif) {
    ko(
      "⑤ optimiseur",
      "/admin/medias/logos/**",
      `refus ${r.statut} mais PAS par le motif (corps : « ${r.corps.slice(0, 80)} ») — ` +
        "le chemin est donc AUTORISÉ dans localPatterns, ce qui ferait écrire un brouillon " +
        "dans .next/cache/images",
    );
  } else {
    ok("⑤ optimiseur", "/admin/medias/logos/**", `${r.statut}, refusé par le MOTIF`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// BASE ET VOLUME DE DÉVELOPPEMENT
// ══════════════════════════════════════════════════════════════════════════════════════


const urlBase = lireVariable("DATABASE_URL");
if (!urlBase) {
  console.log("🔴 DATABASE_URL introuvable — la moitié B ne peut pas s'exécuter.");
  process.exit(1);
}

const mediaDirBrut = lireVariable("MEDIA_DIR");
if (!mediaDirBrut) {
  console.log("🔴 MEDIA_DIR introuvable — le décompte de fichiers ne peut pas s'exécuter.");
  process.exit(1);
}
const MEDIA_DIR = resolve(RACINE_APP, mediaDirBrut);
// ⚠️ Défaut d'instrument hérité de la 6.4 : `server/medias` lit `process.env.MEDIA_DIR`, et
// cette porte n'est pas Next — personne n'a chargé `.env.local` dans son processus. On injecte
// la valeur ABSOLUE : `racine()` la résout contre le cwd, qui n'est pas garanti.
process.env.MEDIA_DIR = MEDIA_DIR;

const sql = postgres(urlBase, { max: 1, onnotice: () => {} });

/** Nombre de fichiers présents sur le volume — le témoin des effets de bord sur le disque. */
function compterFichiers(): number {
  if (!existsSync(MEDIA_DIR)) return -1;
  return readdirSync(MEDIA_DIR).length;
}

/** État du volume AVANT toute écriture de cette porte — référence de la garde ⑬. */
const VOLUME_AU_DEPART = compterFichiers();

// 🔴 IMPORT DYNAMIQUE, APRÈS l'injection de `MEDIA_DIR` : le module résout sa racine
// PARESSEUSEMENT, mais mieux vaut ne pas dépendre de l'ordre d'évaluation des imports
// statiques d'ESM (qui sont hissés).
const { normaliserLogo, supprimerMedia } = await import("../../src/server/medias/index.js");

// ══════════════════════════════════════════════════════════════════════════════════════
// MOITIÉ B — CE QUE LA BASE REFUSE, ET CE QUE LES CONTRATS GARANTISSENT
// ══════════════════════════════════════════════════════════════════════════════════════

// ── ⑥  AUCUN PARTENAIRE NON PUBLIÉ DANS LE HTML PUBLIC ─────────────────────────────
//
// 🔴 ON N'INVENTE PAS UN MARQUEUR : on crée une ligne NON PUBLIÉE au nom improbable, on
// demande les deux pages publiques, et on vérifie que ce nom n'y apparaît pas. C'est une
// mesure d'EFFET, pas une lecture de code.
{
  const temoin = `ZZ-Temoin-Porte-${Date.now().toString(36)}`;
  await sql`insert into partner (name, category, is_published) values (${temoin}, 'sponsor', ${AUTOTEST})`;
  try {
    for (const page of ["/", "/partenaires"]) {
      const r = await demander(page);
      if (r.corps.includes(temoin)) {
        ko("⑥ brouillon public", page, `le nom d'un partenaire NON PUBLIÉ apparaît dans le HTML servi`);
      } else {
        ok("⑥ brouillon public", page, "aucun partenaire non publié dans le HTML servi");
      }
    }
  } finally {
    await sql`delete from partner where name = ${temoin}`;
  }
}

// ── ⑦  LA BASE REFUSE CE QUE ZOD REFUSE — écritures SQL directes, hors de tout schéma ──
//
// 🔴 CHAQUE LIGNE CI-DESSOUS DOIT ÉCHOUER. Un `UPDATE` direct, une restauration de sauvegarde
// ou une migration de données ne passent par AUCUN schéma Zod : la base est le garde-fou qu'on
// ne peut pas contourner.
// ⚠️ Rappel de la 6.3 : **un `CHECK` qui vaut `NULL` PASSE**. Les branches `is null or …` sont
// donc éprouvées telles quelles, sur le cas « colonne nulle ».
// 🔴 DÉFAUT D'INSTRUMENT N°1, TROUVÉ EN EXÉCUTANT LA PORTE POUR LA PREMIÈRE FOIS — ET IL NE
// RENDAIT AUCUN VERDICT, IL SE BLOQUAIT.
//
// La première version écrivait chaque cas comme `() => sql\`insert …\``, puis les exécutait
// dans `sql.begin(async (tx) => …)`. Le client est ouvert avec `max: 1` (une seule connexion,
// comme les portes voisines) : la transaction TIENT cette connexion, et l'`insert` du cas
// demandait la MÊME connexion au pool. Interblocage — la porte tournait indéfiniment sans
// afficher une seule ligne.
// ⚠️ C'est `pieges/instrument-non-valide.md` dans sa forme la plus coûteuse : un instrument
// qui ne rend PAS de faux verdict, mais qui n'en rend aucun. Chaque cas reçoit donc `tx` en
// paramètre — il n'y a plus qu'un seul chemin vers la base.
type EcritureRefusee = {
  quoi: string;
  contrainte: string;
  ecrire: (tx: postgres.TransactionSql) => Promise<unknown>;
};

const ECRITURES_REFUSEES: EcritureRefusee[] = [
  {
    quoi: "name vide",
    contrainte: "partner_name_valide",
    ecrire: (tx) => tx`insert into partner (name, category) values ('   ', 'sponsor')`,
  },
  {
    quoi: `name à ${NAME_MAX + 1}`,
    contrainte: "partner_name_valide",
    ecrire: (tx) =>
      tx`insert into partner (name, category) values (${"a".repeat(NAME_MAX + 1)}, 'sponsor')`,
  },
  {
    quoi: `description à ${DESCRIPTION_MAX + 1}`,
    contrainte: "partner_description_valide",
    ecrire: (tx) =>
      tx`insert into partner (name, category, description) values ('T', 'sponsor', ${"b".repeat(DESCRIPTION_MAX + 1)})`,
  },
  {
    quoi: `link à ${LINK_MAX + 1}`,
    contrainte: "partner_link_valide",
    ecrire: (tx) =>
      tx`insert into partner (name, category, link) values ('T', 'sponsor', ${"https://" + "c".repeat(LINK_MAX - 7)})`,
  },
  {
    quoi: "logo = chemin arbitraire",
    contrainte: "partner_logo_valide",
    ecrire: (tx) => tx`insert into partner (name, category, logo) values ('T', 'sponsor', '/etc/passwd')`,
  },
  {
    quoi: "logo = traversée",
    contrainte: "partner_logo_valide",
    ecrire: (tx) =>
      tx`insert into partner (name, category, logo) values ('T', 'sponsor', '/medias/logos/../../.env')`,
  },
  {
    // 🔴 LE PIÈGE DU POINT, ÉPROUVÉ NOMMÉMENT. Si le `\\.` de la migration avait été écrit
    // `\.`, le point serait devenu « n'importe quel caractère » et cette valeur passerait.
    // Rien d'autre ne le verrait — ni typecheck, ni build, ni un essai de noms valides.
    quoi: "logo = « axwebp » (point non littéral)",
    contrainte: "partner_logo_valide",
    ecrire: (tx) =>
      tx`insert into partner (name, category, logo) values ('T', 'sponsor', '/medias/logos/axwebp')`,
  },
  {
    quoi: "logo = extension non webp",
    contrainte: "partner_logo_valide",
    ecrire: (tx) =>
      tx`insert into partner (name, category, logo) values ('T', 'sponsor', '/medias/logos/a.png')`,
  },
  {
    quoi: "logo = préfixe non autorisé",
    contrainte: "partner_logo_valide",
    ecrire: (tx) => tx`insert into partner (name, category, logo) values ('T', 'sponsor', '/medias/a.webp')`,
  },
  {
    quoi: "logo déjà pris par un autre partenaire",
    contrainte: "partner_logo_unique",
    ecrire: (tx) =>
      tx`insert into partner (name, category, logo) values ('T', 'sponsor', '/partenaires/forgeblast.webp')`,
  },
];

for (const cas of ECRITURES_REFUSEES) {
  // En autotest, on présente une écriture parfaitement VALIDE là où la porte attend un refus.
  // Si la garde est réelle, elle échoue ; si elle reste verte, elle ne mesure rien.
  const ecrire: EcritureRefusee["ecrire"] = AUTOTEST
    ? (tx) => tx`insert into partner (name, category) values ('Temoin autotest', 'sponsor')`
    : cas.ecrire;

  let refuse: string | null = null;
  try {
    await sql.begin(async (tx) => {
      await ecrire(tx);
      // On annule TOUJOURS : cette porte ne laisse rien derrière elle. Une écriture qui
      // arriverait jusqu'ici n'a pas été refusée — le `throw` la défait ET le signale.
      throw new Error("__rollback__");
    });
  } catch (erreur) {
    const details = erreur as { message?: string; constraint_name?: string; constraint?: string };
    refuse =
      details.constraint_name ?? details.constraint ?? (details.message === "__rollback__" ? null : "?");
  }

  if (refuse === null) {
    ko("⑦ la base refuse", cas.quoi, "ACCEPTÉ — la contrainte ne tient pas");
  } else if (refuse !== cas.contrainte && !AUTOTEST) {
    ko("⑦ la base refuse", cas.quoi, `refusé par « ${refuse} » au lieu de « ${cas.contrainte} »`);
  } else {
    ok("⑦ la base refuse", cas.quoi, `refusé par « ${refuse} »`);
  }
}

// ── ⑧  ZOD REFUSE CE QUE LA BASE NE PEUT PAS VOIR ──────────────────────────────────
//
// `btrim` ne retire que les blancs ASCII : le caractère de largeur nulle est le cas que la
// base laisse passer et que `visiblementVide()` attrape, au point de saisie.
{
  const CAS_ZOD: { quoi: string; valeur: Record<string, unknown> }[] = [
    { quoi: "name fait de deux U+200B", valeur: { name: "​​", category: "sponsor" } },
    { quoi: "link relatif (« mately.fr »)", valeur: { name: "Ok", category: "sponsor", link: "mately.fr" } },
    { quoi: "link en « HTTPS:// » (casse)", valeur: { name: "Ok", category: "sponsor", link: "HTTPS://exemple.fr" } },
    { quoi: "link « https:exemple.fr » (sans slash)", valeur: { name: "Ok", category: "sponsor", link: "https:exemple.fr" } },
    { quoi: "link « javascript: »", valeur: { name: "Ok", category: "sponsor", link: "javascript:alert(1)" } },
    { quoi: "logo saisi à la main", valeur: { name: "Ok", category: "sponsor", logo: "/uploads/x.webp" } },
    { quoi: "catégorie inconnue", valeur: { name: "Ok", category: "mecene" } },
  ];
  for (const cas of CAS_ZOD) {
    // En autotest : une valeur parfaitement valide là où la porte attend un refus.
    const valeur = AUTOTEST ? { name: "Structure valide", category: "sponsor" } : cas.valeur;
    const resultat = partnerInputSchema.safeParse(valeur);
    if (resultat.success) {
      ko("⑧ Zod refuse", cas.quoi, "ACCEPTÉ — la garde de saisie ne tient pas");
    } else {
      ok("⑧ Zod refuse", cas.quoi, `refusé : « ${resultat.error.issues[0]?.message.slice(0, 60)}… »`);
    }
  }
  // Contre-épreuve : les deux formes LÉGITIMES de `logo` passent, sinon la liste blanche
  // serait trop stricte et le seed lui-même deviendrait invalide.
  for (const valide of ["/partenaires/forgeblast.webp", cheminLogo("0e5f1b2c-3d4a-4b5c-8d9e-0f1a2b3c4d5e.webp")]) {
    const r = partnerInputSchema.safeParse({ name: "Ok", category: "sponsor", logo: valide });
    if (r.success) ok("⑧ Zod accepte", valide, "forme légitime acceptée");
    else ko("⑧ Zod accepte", valide, `REFUSÉE : ${r.error.issues[0]?.message}`);
  }
}

// ── ⑨  LES DEUX SENS DU PRÉFIXE — CE QUI PROTÈGE `public/` DE LA SUPPRESSION ────────
{
  const CAS_PREFIXE: { valeur: string | null; duVolume: boolean }[] = [
    { valeur: "/partenaires/forgeblast.webp", duVolume: false },
    { valeur: cheminLogo("abc.webp"), duVolume: true },
    { valeur: "/medias/logotheque/abc.webp", duVolume: false },
    { valeur: null, duVolume: false },
  ];
  for (const cas of CAS_PREFIXE) {
    const obtenu = estLogoDuVolume(AUTOTEST ? cheminLogo("triche.webp") : cas.valeur);
    if (obtenu !== cas.duVolume) {
      ko("⑨ préfixe", String(cas.valeur), `estLogoDuVolume = ${obtenu}, attendu ${cas.duVolume}`);
    } else {
      ok("⑨ préfixe", String(cas.valeur), `du volume = ${obtenu}`);
    }
  }
  // `nomFichierLogo` ne rend un nom QUE pour le volume : c'est ce qui empêche
  // `supprimerMedia` d'être appelé sur un fichier de `public/`.
  const nomPublic = nomFichierLogo("/partenaires/forgeblast.webp");
  if (nomPublic !== null) ko("⑨ préfixe", "/partenaires/…", `nomFichierLogo rend « ${nomPublic} » au lieu de null`);
  else ok("⑨ préfixe", "/partenaires/…", "nomFichierLogo rend null — aucune suppression possible");

  // `sourceLogo` ne réécrit QUE les valeurs du volume, et emporte le préfixe d'admin.
  const admin = sourceLogo(cheminLogo("abc.webp"), true);
  const statique = sourceLogo("/partenaires/forgeblast.webp", true);
  if (!admin.startsWith("/admin/medias/logos/")) ko("⑨ sourceAdmin", "volume", `rend « ${admin} »`);
  else ok("⑨ sourceAdmin", "volume", `« ${admin} »`);
  if (statique !== "/partenaires/forgeblast.webp") ko("⑨ sourceAdmin", "public/", `réécrit en « ${statique} »`);
  else ok("⑨ sourceAdmin", "public/", "non réécrit — servi en statique des deux côtés");
}

// ── ⑩  LA NORMALISATION — CE QUE LE FICHIER DEVIENT, PAS SEULEMENT QU'IL ARRIVE ────
//
// 🔴 LA GARDE PROPRE À CETTE STORY. `gate:galerie` vérifie qu'un fichier accepté est bien
// écrit ; ici il est RÉÉCRIT, donc il faut mesurer le résultat. Le cas de la bannière est le
// plus important : sans borne de LARGEUR, `resize({ height })` la laisse passer INTACTE
// (mesuré : 4000×96 → 4000×96), et rien dans le projet ne le verrait.
const aEcrire: string[] = [];
{
  const CAS_NORMALISATION: {
    quoi: string;
    buffer: () => Promise<Buffer>;
    attendu: [number, number];
    plusPetit: boolean;
    /** 🔴 Le fichier produit est-il un FILET illisible ? Garde née de la revue. */
    filet: boolean;
  }[] = [
    {
      quoi: "logo réel 331×96 — NO-OP attendu",
      buffer: () => sharp(join(RACINE_APP, "public/partenaires/forgeblast.webp")).toBuffer(),
      attendu: [331, LOGO_HAUTEUR],
      plusPetit: false,
      filet: false,
    },
    {
      quoi: "carré 1000×1000",
      buffer: () =>
        sharp({ create: { width: 1000, height: 1000, channels: 4, background: { r: 218, g: 178, b: 101, alpha: 1 } } })
          .png()
          .toBuffer(),
      attendu: [LOGO_HAUTEUR, LOGO_HAUTEUR],
      plusPetit: false,
      filet: false,
    },
    {
      quoi: "🔴 bannière 4000×96 — la LARGEUR doit être bornée",
      buffer: () =>
        sharp({ create: { width: 4000, height: 96, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } } })
          .png()
          .toBuffer(),
      attendu: [LOGO_LARGEUR_MAX, 9],
      plusPetit: false,
      filet: true,
    },
    {
      quoi: "trop petit 138×40 — NON agrandi, et DIT",
      buffer: async () =>
        sharp(join(RACINE_APP, "public/partenaires/forgeblast.webp")).resize({ height: 40 }).toBuffer(),
      attendu: [138, 40],
      plusPetit: true,
      filet: false,
    },
    {
      // 🔴 LE CAS MIROIR, TROUVÉ EN REVUE (Edge Case Hunter) PUIS MESURÉ. La bannière LARGE
      // était gardée ; la bannière HAUTE ne l'était pas, et elle produit exactement le même
      // rendu inexploitable — 2 px de large dans la tuile, sans le moindre avertissement.
      quoi: "🔴 bannière HAUTE 96×4000 — le MIROIR, et il doit AVERTIR",
      buffer: async () =>
        sharp({ create: { width: 96, height: 4000, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } } })
          .png()
          .toBuffer(),
      attendu: [2, LOGO_HAUTEUR],
      plusPetit: false,
      filet: true,
    },
  ];

  for (const cas of CAS_NORMALISATION) {
    // En autotest : on présente une image DÉJÀ conforme là où la porte attend une
    // transformation. Les attentes de dimensions ne peuvent alors pas toutes être satisfaites.
    const source = AUTOTEST
      ? await sharp({ create: { width: 10, height: 10, channels: 3, background: "#000" } }).png().toBuffer()
      : await cas.buffer();

    const r = await normaliserLogo(source);
    if (!r.ok) {
      ko("⑩ normalisation", cas.quoi, `REFUSÉ (${r.echec.motif})`);
      continue;
    }
    aEcrire.push(r.filename);

    const obtenu: [number, number] = [r.largeur, r.hauteur];
    // 🔴 DÉFAUT D'INSTRUMENT N°2 : `sharp(<chemin>)` GARDE UN HANDLE OUVERT.
    // Mesuré sous Windows en prouvant cette porte : le `unlink` du ménage échouait ensuite
    // avec `EBUSY`, et la porte laissait **3 fichiers** sur le volume — silencieusement,
    // puisque `supprimerMedia` ne fait que journaliser. Un instrument qui pollue ce qu'il
    // mesure est un instrument faux (`pieges/instrument-non-valide.md`).
    // ⇒ On lit un BUFFER, jamais un chemin. La garde ⑬ vérifie désormais le ménage.
    const meta = await sharp(readFileSync(join(MEDIA_DIR, r.filename))).metadata();

    if (obtenu[0] !== cas.attendu[0] || obtenu[1] !== cas.attendu[1]) {
      ko("⑩ normalisation", cas.quoi, `${obtenu[0]}×${obtenu[1]} au lieu de ${cas.attendu[0]}×${cas.attendu[1]}`);
    } else if (meta.format !== "webp") {
      ko("⑩ normalisation", cas.quoi, `format « ${meta.format} » au lieu de webp`);
    } else if (r.plusPetitQueLaBoite !== cas.plusPetit) {
      ko("⑩ normalisation", cas.quoi, `plusPetitQueLaBoite = ${r.plusPetitQueLaBoite}, attendu ${cas.plusPetit}`);
    } else if (r.filet !== cas.filet) {
      // 🔴 Un fichier produit illisible SANS avertissement est le défaut que la revue a
      // trouvé : le redimensionnement réussit, et personne ne dit que le résultat ne sert
      // à rien. C'est `pieges/garde-nominale.md` — « la borne a tenu » ne veut pas dire
      // « le résultat est utilisable ».
      ko("⑩ normalisation", cas.quoi, `filet = ${r.filet}, attendu ${cas.filet} — un rendu illisible qui ne s'annonce pas`);
    } else {
      ok("⑩ normalisation", cas.quoi, `${obtenu[0]}×${obtenu[1]} webp${r.plusPetitQueLaBoite ? " (+ avert. trop petit)" : ""}${r.filet ? " (+ avert. FILET)" : ""}`);
    }
  }

  // 🔴 LE RAPPORT D'ASPECT EST TOUJOURS CONSERVÉ — vérifié par le CALCUL, pas par confiance.
  // Une image 300×200 (ratio 1,5) doit rester à 1,5 après normalisation, à un pixel près.
  const source = await sharp({ create: { width: 300, height: 200, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } } })
    .png()
    .toBuffer();
  const r = await normaliserLogo(source);
  if (r.ok) {
    aEcrire.push(r.filename);
    const ratioAvant = 300 / 200;
    const ratioApres = r.largeur / r.hauteur;
    const ecart = Math.abs(ratioAvant - ratioApres);
    // Tolérance d'un demi-pixel sur la plus petite dimension : un redimensionnement entier ne
    // peut pas rendre un ratio exact, et exiger l'exactitude ferait une porte fausse.
    const tolerance = 0.5 / r.hauteur;
    if (ecart > tolerance) {
      ko("⑩ aspect", "300×200", `ratio ${ratioApres.toFixed(4)} au lieu de ${ratioAvant.toFixed(4)} — DÉFORMÉ`);
    } else {
      ok("⑩ aspect", "300×200", `${r.largeur}×${r.hauteur}, ratio conservé (écart ${ecart.toFixed(5)})`);
    }
  } else {
    ko("⑩ aspect", "300×200", `REFUSÉ (${r.echec.motif})`);
  }
}

// ── ⑪  UN REFUS NE LAISSE AUCUN OCTET ──────────────────────────────────────────────
//
// 🔴 LE SEUL TÉMOIN EST LE DISQUE : « une écriture refusée ne laisse rien » ne se lit dans
// aucune valeur de retour. On compte avant, on compte après.
{
  const REFUS: { quoi: string; buffer: () => Promise<Buffer>; motif: string }[] = [
    {
      quoi: "SVG (XSS stocké)",
      buffer: async () =>
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100"/></svg>'),
      motif: "svg",
    },
    {
      quoi: "texte renommé en image",
      buffer: async () => Buffer.from("ceci n'est pas une image, quel que soit son nom"),
      motif: "illisible",
    },
    {
      quoi: "GIF (hors liste blanche)",
      buffer: async () =>
        sharp({ create: { width: 10, height: 10, channels: 3, background: "#000" } }).gif().toBuffer(),
      motif: "format",
    },
  ];

  for (const cas of REFUS) {
    const avant = compterFichiers();
    // En autotest : une image PARFAITEMENT valide là où la porte attend un refus.
    const source = AUTOTEST
      ? await sharp({ create: { width: 50, height: 50, channels: 3, background: "#fff" } }).png().toBuffer()
      : await cas.buffer();
    const r = await normaliserLogo(source);
    const apres = compterFichiers();

    if (r.ok) {
      aEcrire.push(r.filename);
      ko("⑪ refus sans octet", cas.quoi, `ACCEPTÉ (${r.filename}) — le contenu n'a pas décidé`);
    } else if (r.echec.motif !== cas.motif) {
      ko("⑪ refus sans octet", cas.quoi, `refusé pour « ${r.echec.motif} » au lieu de « ${cas.motif} »`);
    } else if (apres !== avant) {
      ko("⑪ refus sans octet", cas.quoi, `${avant} → ${apres} fichiers — un octet a été posé malgré le refus`);
    } else {
      ok("⑪ refus sans octet", cas.quoi, `refusé (${r.echec.motif}), volume inchangé (${avant})`);
    }
  }
}

// ── ⑫  LE CYCLE DE VIE D'UN FICHIER : +1 À L'ÉCRITURE, −1 AU RETRAIT ───────────────
//
// 🔴 C'EST LE MÉCANISME QUE `remplacerLogoPartenaire` ET `retirerLogoPartenaire` COMPOSENT.
// Un remplacement écrit le nouveau (+1) puis retire l'ancien (−1) : le volume revient à son
// compte. Sans le retrait, chaque changement de charte laisserait un octet orphelin.
{
  const avant = compterFichiers();
  const source = await sharp(join(RACINE_APP, "public/partenaires/l-antre-de-reims.webp")).toBuffer();

  const premier = await normaliserLogo(source);
  const apresEcriture = compterFichiers();
  if (!premier.ok) {
    ko("⑫ cycle de vie", "écriture", `REFUSÉE (${premier.echec.motif})`);
  } else {
    if (apresEcriture !== avant + 1) {
      ko("⑫ cycle de vie", "écriture", `${avant} → ${apresEcriture}, attendu ${avant + 1}`);
    } else {
      ok("⑫ cycle de vie", "écriture", `${avant} → ${apresEcriture} (+1)`);
    }

    // Remplacement : on écrit le nouveau, on retire l'ancien.
    const second = await normaliserLogo(source);
    if (second.ok) {
      const retire = await supprimerMedia(AUTOTEST ? "n-existe-pas-du-tout.webp" : premier.filename);
      const apresRemplacement = compterFichiers();
      if (!retire || apresRemplacement !== apresEcriture + 1 - 1) {
        ko(
          "⑫ cycle de vie",
          "remplacement",
          `${apresEcriture} → ${apresRemplacement}, attendu ${apresEcriture} (+1 puis −1)`,
        );
      } else {
        ok("⑫ cycle de vie", "remplacement", `${apresEcriture} → ${apresRemplacement} (+1 −1, inchangé)`);
      }
      // Retrait final : −1, on revient au compte initial.
      await supprimerMedia(second.filename);
      const apresRetrait = compterFichiers();
      if (apresRetrait !== avant) {
        ko("⑫ cycle de vie", "retrait", `${apresRemplacement} → ${apresRetrait}, attendu ${avant}`);
      } else {
        ok("⑫ cycle de vie", "retrait", `retour au compte initial (${avant})`);
      }
    }
  }
}

// ── ⑬  MÉNAGE : CETTE PORTE NE LAISSE RIEN DERRIÈRE ELLE, ET ELLE LE VÉRIFIE ───────
//
// 🔴 GARDE NÉE D'UN DÉFAUT DE CET INSTRUMENT, TROUVÉ EN LE PROUVANT. La première version
// affichait le décompte en fin de sortie **sans en faire un verdict** : elle a laissé 3
// fichiers sur le volume et est restée VERTE. Un instrument qui pollue ce qu'il mesure fausse
// toutes ses exécutions suivantes — le décompte de la garde ⑪ (« volume inchangé ») dérive à
// chaque passage.
const avantMenage = compterFichiers();
for (const nom of aEcrire) await supprimerMedia(nom);
const apresMenage = compterFichiers();
if (apresMenage !== VOLUME_AU_DEPART) {
  ko(
    "⑬ ménage",
    "volume",
    `${apresMenage} fichier(s) au lieu des ${VOLUME_AU_DEPART} du départ — la porte a laissé ` +
      `${apresMenage - VOLUME_AU_DEPART} fichier(s) derrière elle`,
  );
} else {
  ok("⑬ ménage", "volume", `${avantMenage} → ${apresMenage}, retour à l'état de départ`);
}
await sql.end();

// ══════════════════════════════════════════════════════════════════════════════════════
// CE QUE CETTE PORTE NE COUVRE PAS — DÉCLARÉ, JAMAIS TU
// ══════════════════════════════════════════════════════════════════════════════════════

exemptions.add(
  "Le chemin AUTHENTIFIÉ (créer, téléverser, remplacer, retirer, ordonner, publier, " +
    "supprimer une fois connecté) — il exige un aller-retour Discord avec un humain. " +
    "Aucune porte ne le remplacera.",
);
exemptions.add(
  "L'APPARENCE des écrans de partenaires ET du bandeau public (ton, rythme, hiérarchie) — " +
    "c'est le gate visuel de Brice, et la passe 1 ne s'outille pas (rétro Epic 5).",
);
exemptions.add(
  "🔴 QU'UNE CATÉGORIE SOIT JUSTE au sens FR33. Cette porte vérifie que la valeur est dans " +
    "l'enum ; elle ne peut PAS voir qu'un bénévole a rangé sous « soutien » une collectivité " +
    "qu'on espère seulement convaincre. C'est un garde-fou ÉDITORIAL, posé au point de saisie.",
);
exemptions.add(
  "Que le LOGO téléversé soit bien celui du partenaire, et qu'il soit lisible sur --navy. Un " +
    "logo blanc sur fond blanc passe toutes les gardes techniques (le seed documente le cas).",
);
exemptions.add(
  "La COMPOSITION des Server Actions (ligne d'abord, fichier ensuite ; l'ancien fichier qui " +
    "part au remplacement). Cette porte mesure le MÉCANISME (garde ⑫) sur `server/medias`, " +
    "pas son orchestration — celle-ci exige une session, donc le gate visuel.",
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
console.log(`  🧹 volume : ${avantMenage} → ${apresMenage} fichier(s) après ménage.`);

if (AUTOTEST) {
  if (echecs.length === 0) {
    console.log("\n🔴 AUTO-VALIDATION ÉCHOUÉE — chaque garde a reçu un cas qu'elle devait voir,");
    console.log("   et la porte reste verte. L'instrument ne mesure rien : ne pas s'y fier.");
    process.exit(1);
  }
  console.log(`\n✅ INSTRUMENT VALIDE — ${echecs.length} garde(s) ont vu le cas qu'on leur présentait.`);
  process.exit(0);
}

if (echecs.length > 0) {
  console.log(`\n🔴 ${echecs.length} GARDE(S) EN ÉCHEC.`);
  process.exit(1);
}
console.log(`\n✅ ${succes.length} GARDE(S) VERTE(S).`);
process.exit(0);
