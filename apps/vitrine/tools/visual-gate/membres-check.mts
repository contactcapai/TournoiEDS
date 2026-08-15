// @porte surface=membres effet=base+disque story=6.10
// 🔬 GARDE DE LA SURFACE « MEMBRES » (Story 6.10) — 16ᵉ instrument du projet.
//
// Pourquoi un contrôle dédié — et ce que RIEN d'autre ne voit :
//
//   défaut possible                                                  lint/build Lighthouse gate œil
//   une route de membres accessible sans session                         ❌        ❌      ❌  ⚠️
//   l'APERÇU (qui rend les brouillons) accessible sans session           ❌        ❌      ❌  ❌
//   🔴 un membre NON PUBLIÉ apparaissant sur /l-asso                     ❌        ❌      ❌  ⚠️
//   🔴 le PORTRAIT d'un membre non publié servi à un inconnu             ❌        ❌      ❌  ❌
//   🔴 un `CHECK` qui vaut NULL, donc qui PASSE (leçon `event_has_venue`)❌        ❌      ❌  ❌
//   `member` borné dans Zod et PAS dans la base                          ❌        ❌      ❌  ❌
//   un prénom de caractères invisibles accepté (`btrim` ne voit pas ZWSP)❌        ❌      ❌  ❌
//   🔴 une équipe qui se RÉORDONNE d'une visite à l'autre (tri partiel)  ❌        ❌      ❌  ⚠️
//   🔴 un champ d'EFFECTIF réintroduit dans le schéma (FR16)             ❌        ❌      ❌  ⚠️
//   🔴 un portrait 4000×96 qui traverse la normalisation INTACT          ❌        ❌      ❌  ⚠️
//   un octet orphelin laissé par un refus — ici une DONNÉE PERSONNELLE   ❌        ❌      ❌  ❌
//   les 3 copies de `texteOptionnel` qui redivergent (dette R37)         ❌        ❌      ❌  ❌
//
// 🔴 DEUX MOITIÉS, PARCE QUE LES DEUX RISQUES NE SE MESURENT PAS AU MÊME ENDROIT :
//   A — HTTP NU, sans aucun cookie : ce que le serveur SERT à un inconnu ;
//   B — ÉCRITURES QUI DOIVENT ÉCHOUER + CONTRATS EXERCÉS, contre la base réelle.
//
// 🔴 CE QUE CETTE PORTE AJOUTE AUX QUATRE AUTRES PORTES DE SURFACE : elle est la première
// dont l'objet est une **DONNÉE PERSONNELLE**. Deux gardes en découlent et n'existent
// nulle part ailleurs :
//   · ⑤ le portrait d'un membre NON PUBLIÉ ne doit pas être servi — une photo de personne
//     que l'association n'a pas choisi de publier ;
//   · ⑭ la sémantique unifiée de `texteOptionnel` (dette R37, soldée par cette story) : trois
//     copies divergentes REFUSAIENT et ACCEPTAIENT la même valeur. Une porte qui ne le
//     vérifierait pas laisserait la divergence revenir en silence — c'est très exactement
//     ce que R37 décrivait : « aucune porte ne voit ces divergences ».
//
// 🔴 ÉCRITE EN TypeScript ET EXÉCUTÉE PAR `tsx`, comme `gate:agenda`, `gate:galerie`,
// `gate:partenaires` et `gate:ateliers`, et pour la même raison : la moitié B doit exercer
// `memberInputSchema` ET `normaliserPortrait` EUX-MÊMES. Une porte qui réimplémenterait ses
// règles validerait sa propre copie et resterait verte le jour où le produit divergerait
// (`00 référence/pieges/garde-nominale.md`).
//
// ⚠️ ELLE A BESOIN DE `--conditions=react-server` (contrairement à `gate:ateliers`) :
// `src/server/medias/` commence par `import "server-only"`, paquet qui LÈVE hors du graphe
// serveur. C'est la conséquence directe du fait que cette surface écrit des FICHIERS.
//
// Tout ce qu'elle écrit en base est annulé par ROLLBACK, sauf les témoins qui doivent
// survivre à leur transaction — et le décompte final le VÉRIFIE, sur la table ET sur le
// volume (leçon de `gate:partenaires`, qui polluait le volume qu'elle mesurait EN RESTANT
// VERTE).
//
// Usage :  pnpm --filter vitrine gate:membres [baseUrl]
//          MEMBRES_AUTOTEST=1 …  → auto-validation de l'instrument
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import sharp from "sharp";

import { BASE as BASE_DEFAUT } from "./config.mjs";
import { lireVariable } from "./env.mjs";
import { PREFIXE_PORTRAIT, PORTRAIT_COTE } from "../../src/lib/portraits";
import {
  estCheminPortraitValide,
  memberInputSchema,
  PORTRAIT_MAX,
  PRENOM_MAX,
  ROLE_MAX,
} from "../../src/lib/schemas/member";
import { eventInputSchema } from "../../src/lib/schemas/event";
import { partnerInputSchema } from "../../src/lib/schemas/partner";
import { workshopInputSchema } from "../../src/lib/schemas/workshop";

const BASE = process.argv[2] ?? BASE_DEFAUT;
const AUTOTEST = process.env.MEMBRES_AUTOTEST === "1";

const echecs: string[] = [];
const succes: string[] = [];
const exemptions = new Set<string>();
const ko = (garde: string, ou: string, quoi: string) => echecs.push(`${garde} ${ou} — ${quoi}`);
const ok = (garde: string, ou: string, quoi: string) => succes.push(`${garde} ${ou} — ${quoi}`);

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE_APP = join(ICI, "..", "..");

async function demander(chemin: string) {
  const reponse = await fetch(BASE + chemin, { redirect: "manual" });
  return {
    statut: reponse.status,
    emplacement: reponse.headers.get("location"),
    corps: await reponse.text(),
  };
}

const estRedirection = (statut: number) => statut >= 300 && statut < 400;
const versLogin = (emplacement: string | null) =>
  typeof emplacement === "string" && emplacement.includes("/admin/login");

console.log(`\n🔎 Surface « membres » — ${BASE}`);
if (AUTOTEST) {
  console.log("   MODE AUTO-VALIDATION : on présente à chaque garde un cas qu'elle doit voir.");
}

// ══════════════════════════════════════════════════════════════════════════════════════
// MOITIÉ A — HTTP NU, SANS AUCUN COOKIE
// ══════════════════════════════════════════════════════════════════════════════════════

/** Un UUID valide, mais qui ne désigne rien : la garde porte sur la ROUTE, pas sur la donnée. */
const UUID_QUELCONQUE = "00000000-0000-4000-8000-000000000000";

const ROUTES_MEMBRES = [
  "/admin/membres",
  "/admin/membres/nouveau",
  "/admin/membres/apercu",
  `/admin/membres/${UUID_QUELCONQUE}`,
];

// En autotest, on présente à la porte une route qu'on SAIT ouverte comme si elle devait être
// protégée. Si les gardes sont réelles, elles échouent. Si elles restent vertes, l'instrument
// ne mesure rien et il ne faut pas se fier à ses verdicts.
const ROUTES_EPROUVEES = AUTOTEST ? ["/admin/login"] : ROUTES_MEMBRES;

/** Marqueurs de CONTENU d'administration — jamais un titre.
 *  ⚠️ Leçon de `gate:admin`, reprise telle quelle : un marqueur pris sur un `<title>` rendrait
 *  la porte rouge sur une redirection parfaitement propre (Next évalue les `metadata` même
 *  quand le rendu s'interrompt). */
const MARQUEURS_ADMIN = [
  "Se déconnecter",
  "Ajouter un membre",
  "Demandez son accord",
  "Retirer du site",
  "membres-module__",
];

for (const route of ROUTES_EPROUVEES) {
  const r = await demander(route);
  const garde = "①";
  if (estRedirection(r.statut) && versLogin(r.emplacement)) {
    ok(garde, route, `${r.statut} → ${r.emplacement}`);
  } else {
    ko(garde, route, `attendu une redirection vers /admin/login, reçu ${r.statut}`);
  }

  const fuite = MARQUEURS_ADMIN.filter((m) => r.corps.includes(m));
  if (fuite.length === 0) ok("②", route, "aucun marqueur d'administration dans le corps servi");
  else ko("②", route, `le corps servi contient ${fuite.map((f) => `« ${f} »`).join(", ")}`);
}

// ── ③ Aucun membre NON PUBLIÉ dans le HTML des 5 pages publiques ─────────────────────
// 🔴 On interroge le HTML SERVI, pas la requête : c'est le seul témoin qui prouve que rien ne
// fuit, quel que soit le chemin de rendu.
const PAGES_PUBLIQUES = ["/", "/agenda", "/animations", "/partenaires", "/l-asso"];

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
// cette porte n'est pas Next — personne n'a chargé `.env.local` dans son processus.
process.env.MEDIA_DIR = MEDIA_DIR;

// ⚠️ `max: 1` ET aucune requête externe à l'intérieur d'un `sql.begin` : la 6.5 s'est BLOQUÉE
// (pas « échouée » — bloquée) parce qu'une connexion externe y était utilisée sur un pool de 1.
const sql = postgres(urlBase, { max: 1, onnotice: () => {} });

function compterFichiers(): number {
  if (!existsSync(MEDIA_DIR)) return -1;
  return readdirSync(MEDIA_DIR).length;
}
const VOLUME_AU_DEPART = compterFichiers();

// 🔴 IMPORT DYNAMIQUE, APRÈS l'injection de `MEDIA_DIR`.
const { normaliserPortrait, supprimerMedia } = await import("../../src/server/medias/index.js");

const avantMenage = Number((await sql`select count(*)::int as n from member`)[0].n);

// ── ③ suite : on PUBLIE un témoin brouillon, puis on vérifie qu'il ne sort nulle part ──
// Le témoin doit survivre à sa transaction (les pages le liraient sinon dans un état invisible),
// il est donc écrit HORS `sql.begin` et supprimé explicitement à la fin.
const TEMOIN_BROUILLON = "ZzBrouillonMembreTemoin";
await sql`
  insert into member (first_name, role, sort_order, is_published)
  values (${TEMOIN_BROUILLON}, ${"RoleTemoinBrouillon"}, 9999, false)
`;

for (const page of PAGES_PUBLIQUES) {
  const r = await demander(page);
  // En autotest on cherche une chaîne qui EST présente sur la page : la garde doit alors
  // échouer. Sinon elle ne mesure rien.
  const aiguille = AUTOTEST ? "Esport des Sacres" : TEMOIN_BROUILLON;
  if (!r.corps.includes(aiguille)) ok("③", page, "aucun membre non publié dans le HTML servi");
  else ko("③", page, `le HTML servi contient « ${aiguille} »`);
}

// ══════════════════════════════════════════════════════════════════════════════════════
// MOITIÉ B — CE QUE LA BASE REFUSE, ET CE QUE LES CONTRATS GARANTISSENT
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * Écritures qui doivent ÉCHOUER. Une contrainte qu'on n'a pas vue refuser n'est pas prouvée.
 *
 * 🔴 CHAQUE EXÉCUTEUR REÇOIT LA **TRANSACTION**, JAMAIS LE POOL EXTERNE — DÉFAUT D'INSTRUMENT
 * PAYÉ EN 6.5, ET REPAYÉ ICI AVANT D'ÊTRE CORRIGÉ. Une première version écrivait
 * `() => sql`insert …`` : à l'intérieur de `sql.begin`, l'unique connexion du pool
 * (`max: 1`) est déjà tenue par la transaction, donc cette seconde requête attend une
 * connexion qui ne se libérera jamais. La porte ne rend alors **aucun verdict** — elle se
 * BLOQUE, ce qui est le pire des états : ni vert, ni rouge, juste une commande qui ne rend
 * jamais la main. Le paramètre `tx` rend l'erreur impossible à refaire.
 */
type Executeur = (tx: postgres.TransactionSql) => Promise<unknown>;

const ECRITURES_INTERDITES: { quoi: string; ex: Executeur }[] = [
  { quoi: "prénom vide", ex: (tx) => tx`insert into member (first_name, role) values ('', 'Role')` },
  {
    quoi: "prénom fait de blancs",
    ex: (tx) => tx`insert into member (first_name, role) values ('   ', 'Role')`,
  },
  {
    quoi: `prénom à ${PRENOM_MAX + 1} caractères`,
    ex: (tx) => tx`insert into member (first_name, role) values (${"a".repeat(PRENOM_MAX + 1)}, 'Role')`,
  },
  { quoi: "rôle vide", ex: (tx) => tx`insert into member (first_name, role) values ('Marie', '')` },
  {
    quoi: `rôle à ${ROLE_MAX + 1} caractères`,
    ex: (tx) => tx`insert into member (first_name, role) values ('Marie', ${"b".repeat(ROLE_MAX + 1)})`,
  },
  {
    quoi: "prénom NULL",
    ex: (tx) => tx`insert into member (first_name, role) values (null, 'Role')`,
  },
  {
    quoi: "portrait hors préfixe (/medias/logos/…)",
    ex: (tx) => tx`insert into member (first_name, role, portrait) values ('Marie','Role','/medias/logos/x.webp')`,
  },
  {
    quoi: "portrait portant une composante de chemin",
    ex: (tx) => tx`insert into member (first_name, role, portrait) values ('Marie','Role','/medias/portraits/sous/x.webp')`,
  },
  {
    // 🔴 LE PIÈGE DU POINT — mesuré en 6.5 : sans `\\.` dans le motif, `axwebp` passerait.
    quoi: "🔴 PIÈGE DU POINT : /medias/portraits/axwebp",
    ex: (tx) => tx`insert into member (first_name, role, portrait) values ('Marie','Role','/medias/portraits/axwebp')`,
  },
  {
    quoi: "portrait contenant une traversée `..`",
    ex: (tx) => tx`insert into member (first_name, role, portrait) values ('Marie','Role','/medias/portraits/a..b.webp')`,
  },
  {
    quoi: `portrait à ${PORTRAIT_MAX + 1} caractères`,
    ex: (tx) => tx`insert into member (first_name, role, portrait) values ('Marie','Role',${PREFIXE_PORTRAIT + "c".repeat(PORTRAIT_MAX + 1 - PREFIXE_PORTRAIT.length - 5) + ".webp"})`,
  },
];

for (const cas of ECRITURES_INTERDITES) {
  // En autotest on remplace l'écriture par une écriture VALIDE : la garde doit alors échouer.
  const execution: Executeur = AUTOTEST
    ? (tx) => tx`insert into member (first_name, role) values ('AutotestValide', 'RoleValide')`
    : cas.ex;
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe("set local statement_timeout = '5s'");
      await execution(tx);
      throw new Error("__ROLLBACK__");
    });
    ko("④", cas.quoi, "ACCEPTÉE par la base — la contrainte ne tient pas");
  } catch (details) {
    const message = (details as Error).message;
    if (message === "__ROLLBACK__") ko("④", cas.quoi, "ACCEPTÉE par la base (annulée ensuite)");
    else ok("④", cas.quoi, "refusée par la base");
  }
}

/** Contre-épreuves : ce qui DOIT passer. Une porte qui refuse tout ne prouve rien. */
const ECRITURES_ATTENDUES: { quoi: string; ex: Executeur }[] = [
  {
    quoi: `prénom PILE à ${PRENOM_MAX} et rôle PILE à ${ROLE_MAX}`,
    ex: (tx) => tx`insert into member (first_name, role) values (${"a".repeat(PRENOM_MAX)}, ${"b".repeat(ROLE_MAX)})`,
  },
  {
    quoi: "portrait NULL (le cas NOMINAL)",
    ex: (tx) => tx`insert into member (first_name, role, portrait) values ('Marie','Role',null)`,
  },
  {
    quoi: "portrait bien formé",
    ex: (tx) => tx`insert into member (first_name, role, portrait) values ('Karim','Role','/medias/portraits/0a1b2c3d-4e5f.webp')`,
  },
];

for (const cas of ECRITURES_ATTENDUES) {
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe("set local statement_timeout = '5s'");
      await cas.ex(tx);
      throw new Error("__ROLLBACK__");
    });
    ko("⑤", cas.quoi, "n'a pas atteint le rollback — cas inattendu");
  } catch (details) {
    const message = (details as Error).message;
    if (message === "__ROLLBACK__") ok("⑤", cas.quoi, "acceptée, comme attendu");
    else ko("⑤", cas.quoi, `REFUSÉE par la base : ${message}`);
  }
}

// ── ⑥ 🔴 PARITÉ BASE ↔ ZOD, LUE DANS LE **TEXTE** DE LA CONTRAINTE ───────────────────
// 🔴 C'EST LA LEÇON LA PLUS CHÈRE DE L'EPIC 6, ET ELLE VIENT DE LA STORY 6.9.
// `event_has_venue` (3.1) s'évaluait à `FALSE OR NULL` = **NULL** dans le cas exact qu'elle
// interdisait, et **un `CHECK` qui vaut NULL PASSE**. Prouvé en 6.9 : en retirant la branche
// `is null` de `workshop_summary_valide`, SEULE la garde qui LIT le texte de la contrainte
// est passée au rouge ; la contre-épreuve par ÉCRITURE est restée VERTE, parce que le défaut
// la rend aveugle PAR CONSTRUCTION.
// ⇒ **Une contrainte null-safe ne se teste pas, elle se LIT.**
const contraintes = await sql<{ conname: string; definition: string }[]>`
  select conname, pg_get_constraintdef(oid) as definition
  from pg_constraint
  where conrelid = 'member'::regclass and contype = 'c'
`;

const ATTENDUES: { nom: string; doitContenir: string[] }[] = [
  { nom: "member_prenom_valide", doitContenir: ["btrim", String(PRENOM_MAX)] },
  { nom: "member_role_valide", doitContenir: ["btrim", String(ROLE_MAX)] },
  {
    nom: "member_portrait_valide",
    // 🔴 « IS NULL » est LA garde : `portrait` est la SEULE colonne nullable bornée de cette
    // table, donc la seule dont la contrainte puisse s'évaluer à NULL.
    doitContenir: ["IS NULL", PREFIXE_PORTRAIT, String(PORTRAIT_MAX)],
  },
];

for (const attendue of ATTENDUES) {
  const trouvee = contraintes.find((c) => c.conname === attendue.nom);
  if (!trouvee) {
    ko("⑥", attendue.nom, "contrainte ABSENTE de la table");
    continue;
  }
  // En autotest, on exige une chaîne qui n'y est pas : la garde doit alors échouer.
  const exigences = AUTOTEST ? ["CHAINE_QUI_N_EXISTE_PAS"] : attendue.doitContenir;
  const manquants = exigences.filter((m) => !trouvee.definition.toUpperCase().includes(m.toUpperCase()));
  if (manquants.length === 0) {
    ok("⑥", attendue.nom, `texte conforme : ${trouvee.definition.slice(0, 60)}…`);
  } else {
    ko(
      "⑥",
      attendue.nom,
      `le TEXTE de la contrainte ne contient pas ${manquants.map((m) => `« ${m} »`).join(", ")} — ` +
        `définition réelle : ${trouvee.definition}`,
    );
  }
}

// ── ⑦ 🔴 L'ABSENCE DE COLONNE D'EFFECTIF EST LE LIVRABLE (FR16) ──────────────────────
// Une règle qu'aucune relecture ne tiendra dans six mois : on la mesure sur le SCHÉMA RÉEL.
const colonnes = await sql<{ column_name: string }[]>`
  select column_name from information_schema.columns
  where table_name = 'member' and table_schema = 'public'
`;
const NOMS = colonnes.map((c) => c.column_name);
const INTERDITES = ["effectif", "count", "total", "nombre", "membres", "compteur", "anciennete"];
const trouveesInterdites = AUTOTEST
  ? ["first_name"] // en autotest, on interdit une colonne qui EXISTE : la garde doit échouer
  : NOMS.filter((n) => INTERDITES.some((i) => n.includes(i)));
if (trouveesInterdites.length === 0) {
  ok("⑦", "FR16", `aucune colonne d'effectif — colonnes réelles : ${NOMS.join(", ")}`);
} else {
  ko("⑦", "FR16", `colonne(s) de comptage présente(s) : ${trouveesInterdites.join(", ")}`);
}

// ── ⑧ ORDRE TOTAL, mesuré par RELECTURES ────────────────────────────────────────────
// `/l-asso` est `force-dynamic` : la requête est rejouée à CHAQUE visite. Un tri partiel ferait
// se réordonner l'équipe d'une visite à l'autre — un scintillement irreproductible.
const suites: string[][] = [];
for (let i = 0; i < 3; i++) {
  const lignes = await sql<{ id: string }[]>`
    select id from member order by sort_order asc, first_name asc, id asc
  `;
  suites.push(lignes.map((l) => l.id));
}
const memeSuite = suites.every((s) => s.join() === suites[0].join());
if (AUTOTEST ? !memeSuite : memeSuite) {
  ok("⑧", "ordre", `${suites[0].length} ligne(s), 3 relectures identiques`);
} else {
  ko("⑧", "ordre", "deux relectures de la MÊME requête rendent des ordres différents");
}

// ── ⑨ `memberInputSchema` EXERCÉ LUI-MÊME ────────────────────────────────────────────
const INVISIBLE = "​".repeat(5);
const CAS_ZOD: { quoi: string; valeur: Record<string, unknown>; doitPasser: boolean }[] = [
  { quoi: "prénom + rôle valides", valeur: { firstName: "Marie", role: "Présidente" }, doitPasser: true },
  { quoi: "prénom d'1 caractère", valeur: { firstName: "M", role: "Présidente" }, doitPasser: false },
  {
    quoi: "prénom de caractères INVISIBLES (btrim ne les voit pas)",
    valeur: { firstName: INVISIBLE, role: "Présidente" },
    doitPasser: false,
  },
  {
    quoi: "rôle de caractères INVISIBLES",
    valeur: { firstName: "Marie", role: INVISIBLE },
    doitPasser: false,
  },
  { quoi: "rôle absent", valeur: { firstName: "Marie" }, doitPasser: false },
  {
    quoi: `prénom PILE à ${PRENOM_MAX}`,
    valeur: { firstName: "a".repeat(PRENOM_MAX), role: "Présidente" },
    doitPasser: true,
  },
  {
    quoi: `prénom à ${PRENOM_MAX + 1}`,
    valeur: { firstName: "a".repeat(PRENOM_MAX + 1), role: "Présidente" },
    doitPasser: false,
  },
  {
    quoi: "sortOrder hors plage int4",
    valeur: { firstName: "Marie", role: "Présidente", sortOrder: 5_000_000_000 },
    doitPasser: false,
  },
  {
    quoi: "portrait hors préfixe",
    valeur: { firstName: "Marie", role: "Présidente", portrait: "/ailleurs/x.webp" },
    doitPasser: false,
  },
  {
    quoi: "portrait bien formé",
    valeur: { firstName: "Marie", role: "Présidente", portrait: `${PREFIXE_PORTRAIT}abc.webp` },
    doitPasser: true,
  },
];

for (const cas of CAS_ZOD) {
  const resultat = memberInputSchema.safeParse(cas.valeur);
  const attendu = AUTOTEST ? !cas.doitPasser : cas.doitPasser;
  if (resultat.success === attendu) {
    ok("⑨", cas.quoi, cas.doitPasser ? "accepté" : "refusé");
  } else {
    ko("⑨", cas.quoi, `Zod a ${resultat.success ? "ACCEPTÉ" : "REFUSÉ"} — l'inverse était attendu`);
  }
}

// ⑨ bis — la fonction de chemin est exercée ELLE-MÊME, pas une copie de son contrat.
// 🔴 LES QUATRE PREMIERS CAS NE SUFFISAIENT PAS — DÉFAUT RÉEL TROUVÉ EN REVUE.
// Cette garde éprouvait « bien formé · piège du point · sous-dossier · mauvais préfixe », et
// ratait donc la vraie divergence : Zod acceptait `ABC123.webp`, `a b.webp` et `été.webp` que
// la base REFUSE. **Une porte censée garantir une parité, et qui ne l'éprouve que sur les cas
// auxquels on a pensé, garantit exactement ces cas-là.** Les six cas ajoutés ci-dessous sont
// ceux que le `CHECK` refuse et que le motif JS devait donc refuser aussi.
for (const [valeur, attendu] of [
  [`${PREFIXE_PORTRAIT}abc.webp`, true],
  [`${PREFIXE_PORTRAIT}0a1b2c3d-4e5f.webp`, true],
  [`${PREFIXE_PORTRAIT}axwebp`, false],
  [`${PREFIXE_PORTRAIT}a/b.webp`, false],
  ["/medias/logos/abc.webp", false],
  // ── les six cas que la première version laissait passer ──────────────────────────
  [`${PREFIXE_PORTRAIT}ABC123.webp`, false], // majuscules
  [`${PREFIXE_PORTRAIT}a b.webp`, false], // espace
  [`${PREFIXE_PORTRAIT}été.webp`, false], // hors ASCII
  [`${PREFIXE_PORTRAIT}_a.webp`, false], // premier caractère non alphanumérique
  [`${PREFIXE_PORTRAIT}a..b.webp`, false], // traversée, que le motif seul autoriserait
  [`${PREFIXE_PORTRAIT}a.png`, false], // autre extension
] as [string, boolean][]) {
  const obtenu = estCheminPortraitValide(valeur);
  if (obtenu === (AUTOTEST ? !attendu : attendu)) ok("⑨b", valeur, `${obtenu}`);
  else ko("⑨b", valeur, `estCheminPortraitValide rend ${obtenu}, attendu ${attendu}`);
}

// ── ⑩ 🔴 LE NORMALISEUR EXERCÉ LUI-MÊME — « BORNER N'EST PAS RENDRE UTILISABLE » ─────
// Leçon centrale de la 6.5 : `resize({ height })` NE BORNE PAS LA LARGEUR. Une source 4000×96
// en ressortait INTACTE. On mesure donc les dimensions de SORTIE, pas la réussite de l'appel.
const fichiersEcrits: string[] = [];
const CAS_NORMALISATION: {
  quoi: string;
  buffer: () => Promise<Buffer>;
  attendu: (r: { largeur: number; hauteur: number; filet: boolean; plusPetitQueLaBoite: boolean }) => boolean;
  dit: string;
}[] = [
  {
    quoi: "carré 1000×1000",
    buffer: () =>
      sharp({ create: { width: 1000, height: 1000, channels: 4, background: { r: 40, g: 40, b: 90, alpha: 1 } } })
        .png()
        .toBuffer(),
    attendu: (r) => r.largeur === PORTRAIT_COTE && r.hauteur === PORTRAIT_COTE && !r.filet,
    dit: `borné à ${PORTRAIT_COTE}×${PORTRAIT_COTE}`,
  },
  {
    quoi: "portrait 3/4 — 900×1200",
    buffer: () =>
      sharp({ create: { width: 900, height: 1200, channels: 4, background: { r: 90, g: 40, b: 40, alpha: 1 } } })
        .png()
        .toBuffer(),
    // `fit: inside` conserve TOUJOURS le ratio : 900×1200 → 240×320, jamais un carré forcé.
    attendu: (r) => r.hauteur === PORTRAIT_COTE && r.largeur === 240,
    dit: "ratio conservé (240×320), aucun recadrage écrit dans le fichier",
  },
  {
    quoi: "🔴 BANNIÈRE 4000×96 (le cas de la 6.5)",
    buffer: () =>
      sharp({ create: { width: 4000, height: 96, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } } })
        .png()
        .toBuffer(),
    // Elle doit être BORNÉE (largeur ≤ 320) **et** signalée comme filet illisible.
    attendu: (r) => r.largeur <= PORTRAIT_COTE && r.filet,
    dit: "bornée ET signalée comme filet",
  },
  {
    quoi: "source trop petite 100×100",
    buffer: () =>
      sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 200, g: 200, b: 200, alpha: 1 } } })
        .png()
        .toBuffer(),
    attendu: (r) => r.largeur === 100 && r.hauteur === 100 && r.plusPetitQueLaBoite,
    dit: "NON agrandie, et signalée comme plus petite que la boîte",
  },
];

for (const cas of CAS_NORMALISATION) {
  const resultat = await normaliserPortrait(await cas.buffer());
  if (!resultat.ok) {
    ko("⑩", cas.quoi, `normalisation refusée (${resultat.echec.motif})`);
    continue;
  }
  fichiersEcrits.push(resultat.filename);
  const conforme = cas.attendu(resultat);
  if (AUTOTEST ? !conforme : conforme) {
    ok("⑩", cas.quoi, `${resultat.largeur}×${resultat.hauteur} — ${cas.dit}`);
  } else {
    ko("⑩", cas.quoi, `sortie ${resultat.largeur}×${resultat.hauteur}, filet=${resultat.filet} — attendu : ${cas.dit}`);
  }
}

// ── ⑪ CYCLE DE VIE DU FICHIER : ce que la porte écrit, elle le reprend ───────────────
const APRES_ECRITURES = compterFichiers();
for (const nom of fichiersEcrits) await supprimerMedia(nom);
const APRES_MENAGE_VOLUME = compterFichiers();

if (APRES_ECRITURES - VOLUME_AU_DEPART === fichiersEcrits.length) {
  ok("⑪", "volume", `+${fichiersEcrits.length} fichier(s) écrit(s), comme attendu`);
} else {
  ko("⑪", "volume", `${VOLUME_AU_DEPART} → ${APRES_ECRITURES} pour ${fichiersEcrits.length} écriture(s)`);
}

// ── ⑫ 🔴 LE MÉNAGE EST UNE GARDE (leçon 6.5 : la porte polluait EN RESTANT VERTE) ────
if (AUTOTEST ? APRES_MENAGE_VOLUME !== VOLUME_AU_DEPART : APRES_MENAGE_VOLUME === VOLUME_AU_DEPART) {
  ok("⑫", "ménage", `volume revenu à ${VOLUME_AU_DEPART} fichier(s) — aucun orphelin laissé`);
} else {
  ko(
    "⑫",
    "ménage",
    `volume à ${APRES_MENAGE_VOLUME} au lieu de ${VOLUME_AU_DEPART} — cette porte a LAISSÉ des fichiers`,
  );
}

// ── ⑬ LE HTML SERVI PORTE BIEN LA SECTION ÉQUIPE ─────────────────────────────────────
// Garde d'ABSENCE inversée : la prose collective de la 2.6 doit RESTER, peuplée ou non.
const lasso = await demander("/l-asso");
const PHRASES_ATTENDUES = AUTOTEST
  ? ["PHRASE_QUI_N_EXISTE_PAS"]
  : ["Une équipe de", "portée par des bénévoles", "Pas de compteur de membres"];
const absentes = PHRASES_ATTENDUES.filter((p) => !lasso.corps.includes(p));
if (absentes.length === 0) {
  ok("⑬", "/l-asso", "la prose collective et l'invariant FR16 sont bien servis");
} else {
  ko("⑬", "/l-asso", `phrase(s) absente(s) du HTML servi : ${absentes.map((a) => `« ${a} »`).join(", ")}`);
}

// ── ⑭ 🔴 DETTE R37 : LES TROIS `texteOptionnel` DISENT LA MÊME CHOSE ─────────────────
// Elles ont divergé en SILENCE pendant trois stories : `event.ts` REFUSAIT ce que `partner.ts`
// et `workshop.ts` ACCEPTAIENT sur une chaîne de caractères invisibles. Aucune porte ne le
// voyait, et un `git diff` sur des caractères invisibles ne montre rien. La 6.10 les a unifiées
// dans `lib/schemas/texte.ts` ; cette garde est ce qui empêche la divergence de revenir.
const CHAINE_INVISIBLE_LONGUE = "​".repeat(300);
const verdicts = [
  {
    nom: "event.description",
    r: eventInputSchema.safeParse({
      title: "Soirée témoin",
      type: "thursday",
      startsAt: "2026-09-03T19:30:00+02:00",
      barId: "",
      venueName: "Bar témoin",
      venueAddress: "",
      games: "",
      description: CHAINE_INVISIBLE_LONGUE,
      recap: "",
      isPublished: false,
    }),
    champ: "description",
  },
  {
    nom: "partner.description",
    r: partnerInputSchema.safeParse({
      name: "Témoin",
      category: "partenaire",
      link: "",
      logo: "",
      description: CHAINE_INVISIBLE_LONGUE,
      sortOrder: 0,
      isPublished: false,
    }),
    champ: "description",
  },
  {
    nom: "workshop.summary",
    r: workshopInputSchema.safeParse({
      title: "Atelier témoin",
      family: "atelier",
      summary: CHAINE_INVISIBLE_LONGUE,
      audience: "",
      sortOrder: 0,
      isPublished: false,
    }),
    champ: "summary",
  },
];

const resultats = verdicts.map((v) => ({
  nom: v.nom,
  accepte: v.r.success,
  valeur: v.r.success ? (v.r.data as Record<string, unknown>)[v.champ] : undefined,
}));
const toutesAcceptent = resultats.every((r) => r.accepte && r.valeur === null);
if (AUTOTEST ? !toutesAcceptent : toutesAcceptent) {
  ok("⑭", "R37", "les 3 schémas ramènent 300 caractères invisibles à `null` — sémantique unifiée");
} else {
  ko(
    "⑭",
    "R37",
    "les 3 copies de `texteOptionnel` ont REDIVERGÉ : " +
      resultats.map((r) => `${r.nom}=${r.accepte ? JSON.stringify(r.valeur) : "REFUSÉ"}`).join(", "),
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════
// MÉNAGE EN BASE + BILAN
// ══════════════════════════════════════════════════════════════════════════════════════
await sql`delete from member where first_name = ${TEMOIN_BROUILLON}`;
const apresMenage = Number((await sql`select count(*)::int as n from member`)[0].n);
await sql.end();

exemptions.add(
  "Que le PORTRAIT d'un membre non publié soit refusé par la route publique : le cas exige " +
    "un fichier réel sur le volume ET une ligne non publiée qui le référence. La garde ③ " +
    "couvre le TEXTE ; le fichier, lui, appartient au gate visuel.",
);
exemptions.add(
  "La COMPOSITION des Server Actions (rang calculé, concurrence optimiste sur le portrait, " +
    "ordre ligne-puis-fichier, suppression qui emporte le fichier). Ces chemins exigent une " +
    "session : ils sont couverts par le gate visuel, pas ici.",
);
exemptions.add(
  "Que le RENDU distingue bien silhouette et photo dans la MÊME boîte. C'est une propriété " +
    "visuelle : `gate` ④ garde le débordement de texte, cette porte garde la donnée — " +
    "la ressemblance appartient à la passe 1 du gate visuel, qui ne s'outille pas.",
);
exemptions.add(
  "Que chaque nouvelle page d'admin appelle bien sa PROPRE garde : sans cookie le proxy " +
    "redirige AVANT que la page ne s'exécute, la fuite est structurellement inobservable ici " +
    "(exemption héritée de `gate:admin`).",
);
exemptions.add(
  "Le CONSENTEMENT de la personne dont le prénom est publié. Aucune porte ne peut le mesurer : " +
    "c'est le rappel du formulaire qui le porte, et lui seul.",
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
console.log(`  🧹 table member : ${avantMenage} → ${apresMenage} ligne(s) après ménage.`);
console.log(`  🧹 volume : ${VOLUME_AU_DEPART} → ${APRES_MENAGE_VOLUME} fichier(s) après ménage.`);

if (AUTOTEST) {
  if (echecs.length === 0) {
    console.log("\n🔴 AUTO-VALIDATION ÉCHOUÉE — chaque garde a reçu un cas qu'elle devait voir,");
    console.log("   et la porte reste verte. L'instrument ne mesure rien : ne pas s'y fier.");
    process.exit(1);
  }
  console.log(`\n✅ INSTRUMENT VALIDE — ${echecs.length} garde(s) ont vu le cas qu'on leur présentait.`);
  // 🔴 ET CE QUE L'AUTOTEST NE PROUVE PAS EST DIT ICI. Une auto-validation qui ne déclare pas
  // sa propre couverture laisse croire que TOUTES les gardes sont éprouvées — c'est la forme
  // la plus discrète de `pieges/instrument-non-valide.md`.
  console.log("\n   ⚠️  TROIS GARDES N'ONT PAS DE CAS D'AUTO-VALIDATION, et ce n'est pas un oubli :");
  console.log("      · ② pas de fuite — la route témoin (/admin/login) ne PORTE aucun marqueur");
  console.log("        d'administration : lui en présenter un demanderait d'en fabriquer un faux,");
  console.log("        donc de valider une chaîne inventée plutôt que la garde.");
  console.log("      · ⑤ contre-épreuves — elles SONT déjà l'inverse de ④ : les inverser à leur");
  console.log("        tour reviendrait à ré-exécuter ④.");
  console.log("      · ⑪ cycle de vie du volume — son cas d'échec est une fuite réelle de fichiers,");
  console.log("        qu'on ne provoque pas exprès sur un volume qu'on sauvegarde.");
  console.log("      ⇒ Leur verdict vert repose sur leur lecture, pas sur une mesure d'échec.");
  process.exit(0);
}

if (echecs.length > 0) {
  console.log(`\n🔴 ${echecs.length} GARDE(S) EN ÉCHEC.`);
  process.exit(1);
}
console.log(`\n✅ ${succes.length} GARDE(S) VERTE(S).`);
process.exit(0);
