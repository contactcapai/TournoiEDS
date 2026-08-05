// 🔬 GARDE DE LA SURFACE « ATELIERS » (Story 6.9) — 15ᵉ instrument du projet.
//
// Pourquoi un contrôle dédié — et ce que RIEN d'autre ne voit :
//
//   défaut possible                                                  lint/build Lighthouse gate œil
//   une route d'ateliers accessible sans session                         ❌        ❌      ❌  ⚠️
//   l'APERÇU (qui rend les brouillons) accessible sans session           ❌        ❌      ❌  ❌
//   🔴 un atelier NON PUBLIÉ apparaissant sur /animations                ❌        ❌      ❌  ⚠️
//   🔴 un `CHECK` qui vaut NULL, donc qui PASSE (leçon `event_has_venue`)❌        ❌      ❌  ❌
//   `workshop` borné dans Zod et PAS dans la base (asymétrie 0006/8/9)   ❌        ❌      ❌  ❌
//   un titre de caractères invisibles accepté (`btrim` ne voit pas U+200B)❌       ❌      ❌  ❌
//   🔴 un catalogue qui se RÉORDONNE d'une visite à l'autre (tri partiel)❌        ❌      ❌  ⚠️
//   un champ de TARIF/DURÉE réintroduit dans le schéma (FR10/FR16)       ❌        ❌      ❌  ⚠️
//   une famille absente de l'enum, donc invisible sur la page publique   ❌        ❌      ❌  ⚠️
//
// 🔴 DEUX MOITIÉS, PARCE QUE LES DEUX RISQUES NE SE MESURENT PAS AU MÊME ENDROIT :
//   A — HTTP NU, sans aucun cookie : ce que le serveur SERT à un inconnu ;
//   B — ÉCRITURES QUI DOIVENT ÉCHOUER + CONTRATS EXERCÉS, contre la base réelle.
//
// 🔴 CE QUE CETTE PORTE AJOUTE AUX TROIS AUTRES PORTES DE SURFACE : elle est la première dont
// le risque central n'est **ni un fichier ni une date**, mais un **ORDRE** et une **ABSENCE**.
//   · l'ordre : le tri du catalogue doit être TOTAL, sinon la page — qui est `force-dynamic`,
//     donc rejouée à chaque visite — se réordonne toute seule. La garde ⑨ le mesure en
//     rejouant la même requête et en comparant les suites obtenues ;
//   · l'absence : la table n'a **pas** de colonne de tarif, de durée ni d'effectif, et c'est
//     le livrable (FR10, FR16). La garde ⑩ lit le SCHÉMA RÉEL de la base pour le vérifier —
//     une règle qu'aucune relecture ne tiendra dans six mois.
//
// 🔴 ÉCRITE EN TypeScript ET EXÉCUTÉE PAR `tsx`, comme `gate:agenda`, `gate:galerie` et
// `gate:partenaires`, et pour la même raison : la moitié B doit exercer `workshopInputSchema`
// LUI-MÊME. Une porte qui réimplémenterait ses règles validerait sa propre copie et resterait
// verte le jour où le produit divergerait (`pieges/garde-nominale.md`).
//
// ⚠️ ELLE N'A PAS BESOIN DE `--conditions=react-server` : contrairement à `gate:galerie` et
// `gate:partenaires`, elle n'importe RIEN de `src/server/` (aucun média, aucun `server-only`).
// C'est une conséquence directe du fait que cette surface est en texte pur. Ne pas ajouter le
// drapeau « par symétrie » — il masquerait le jour où un import serveur s'y glisserait.
//
// ⚠️ La moitié B écrit dans la base de DÉVELOPPEMENT. Chaque écriture vit dans une transaction
// ROLLBACK, sauf les témoins des gardes ⑤ et ⑨, qui sont supprimés explicitement — et le
// décompte final le VÉRIFIE (leçon de `gate:partenaires`, qui polluait le volume qu'elle
// mesurait EN RESTANT VERTE).
//
// Usage :  pnpm --filter vitrine gate:ateliers [baseUrl]
//          ATELIERS_AUTOTEST=1 …  → auto-validation de l'instrument
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

import { BASE as BASE_DEFAUT } from "./config.mjs";
import { LIBELLES_FAMILLE } from "../../src/lib/familles-ateliers";
import {
  PUBLIC_MAX,
  RESUME_MAX,
  TITRE_MAX,
  WORKSHOP_FAMILIES,
  workshopInputSchema,
} from "../../src/lib/schemas/workshop";

const BASE = process.argv[2] ?? BASE_DEFAUT;
const AUTOTEST = process.env.ATELIERS_AUTOTEST === "1";

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

console.log(`\n🔎 Surface « ateliers » — ${BASE}`);
if (AUTOTEST) {
  console.log("   MODE AUTO-VALIDATION : on présente à chaque garde un cas qu'elle doit voir.");
}

// ══════════════════════════════════════════════════════════════════════════════════════
// MOITIÉ A — HTTP NU, SANS AUCUN COOKIE
// ══════════════════════════════════════════════════════════════════════════════════════

/** Un UUID valide, mais qui ne désigne rien : la garde porte sur la ROUTE, pas sur la donnée. */
const UUID_QUELCONQUE = "00000000-0000-4000-8000-000000000000";

const ROUTES_ATELIERS = [
  "/admin/ateliers",
  "/admin/ateliers/nouveau",
  "/admin/ateliers/apercu",
  `/admin/ateliers/${UUID_QUELCONQUE}`,
];

// En autotest, on présente à la porte une route qu'on SAIT ouverte comme si elle devait être
// protégée. Si les gardes sont réelles, elles échouent. Si elles restent vertes, l'instrument
// ne mesure rien et il ne faut pas se fier à ses verdicts.
const ROUTES_EPROUVEES = AUTOTEST ? ["/admin/login"] : ROUTES_ATELIERS;

/** Marqueurs de CONTENU d'administration — jamais un titre.
 *  ⚠️ Leçon de `gate:admin`, reprise telle quelle : un marqueur pris sur un `<title>` rendrait
 *  la porte rouge sur une redirection parfaitement propre (Next évalue les `metadata` même
 *  quand le rendu s'interrompt). */
const MARQUEURS_ADMIN = [
  "Se déconnecter",
  "Ajouter un atelier",
  "Décrivez ce qui existe déjà",
  "Retirer de l&#x27;offre",
  "ateliers-module__",
];

for (const route of ROUTES_EPROUVEES) {
  const r = await demander(route);

  // ── ①  SANS SESSION, LA ROUTE REDIRIGE VERS LE LOGIN ──────────────────────────────
  if (estRedirection(r.statut) && versLogin(r.emplacement)) {
    ok("① garde d'accès", route, `${r.statut} → ${r.emplacement}`);
  } else {
    ko("① garde d'accès", route, `attendu 3xx → /admin/login, obtenu ${r.statut}`);
  }

  // ── ②  ET LE CORPS NE FUIT AUCUN CONTENU D'ADMINISTRATION ─────────────────────────
  //
  // 🔴 LE CODE DE STATUT NE SUFFIT PAS. C'est la leçon de `pieges/faux-succes.md` appliquée
  // à une redirection : Next peut rendre un corps ET renvoyer un 307. On lit donc ce qui est
  // SERVI, pas ce qui est annoncé.
  const fuite = MARQUEURS_ADMIN.filter((m) => r.corps.includes(m));
  if (fuite.length === 0) {
    ok("② pas de fuite", route, "aucun contenu d'administration dans le corps servi");
  } else {
    ko("② pas de fuite", route, `le corps servi contient : ${fuite.join(", ")}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// MOITIÉ B — CE QUE LA BASE REFUSE, ET CE QUE LES CONTRATS GARANTISSENT
// ══════════════════════════════════════════════════════════════════════════════════════

function lireVariable(nom: string): string | null {
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
  process.exit(1);
}

const sql = postgres(urlBase, { max: 1 });

/** Compte les lignes : sert le décompte de ménage de la fin (garde ⑫). */
async function compterAteliers(): Promise<number> {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from workshop`;
  return n;
}

const avantMenage = await compterAteliers();

// ── ③  LE CONTRAT ZOD EST EXERCÉ LUI-MÊME, PAS RÉIMPLÉMENTÉ ───────────────────────────
//
// 🔴 `workshopInputSchema` est IMPORTÉ, et c'est le point de l'écriture en TypeScript. Une
// porte qui recopierait ses règles validerait sa propre copie (`pieges/garde-nominale.md`).
{
  const cas: { quoi: string; valeur: unknown; doitPasser: boolean }[] = [
    { quoi: "titre vide", valeur: { title: "", family: "atelier" }, doitPasser: false },
    { quoi: "titre d'un caractère", valeur: { title: "a", family: "atelier" }, doitPasser: false },
    {
      // 🔴 LE CAS QUE LA BASE NE PEUT PAS VOIR : `btrim` ne retire pas U+200B (leçon 6.3).
      // Zod est le SEUL des deux à pouvoir le refuser — si ce cas passait, un atelier au
      // titre invisible serait publiable, et rendrait une puce vide sur /animations.
      quoi: "titre de deux caractères INVISIBLES (U+200B)",
      valeur: { title: "​​", family: "atelier" },
      doitPasser: false,
    },
    {
      quoi: `titre à ${TITRE_MAX + 1}`,
      valeur: { title: "a".repeat(TITRE_MAX + 1), family: "atelier" },
      doitPasser: false,
    },
    { quoi: "famille inconnue", valeur: { title: "Valide", family: "conference" }, doitPasser: false },
    {
      quoi: `description à ${RESUME_MAX + 1}`,
      valeur: { title: "Valide", family: "atelier", summary: "a".repeat(RESUME_MAX + 1) },
      doitPasser: false,
    },
    {
      quoi: `public visé à ${PUBLIC_MAX + 1}`,
      valeur: { title: "Valide", family: "atelier", audience: "a".repeat(PUBLIC_MAX + 1) },
      doitPasser: false,
    },
    {
      quoi: "sortOrder hors plage int4",
      valeur: { title: "Valide", family: "atelier", sortOrder: 5_000_000_000 },
      doitPasser: false,
    },
    { quoi: "minimal valide", valeur: { title: "Valide", family: "atelier" }, doitPasser: true },
    {
      quoi: "description et public visé VIDES → null",
      valeur: { title: "Valide", family: "atelier", summary: "", audience: "  " },
      doitPasser: true,
    },
  ];

  for (const c of cas) {
    const analyse = workshopInputSchema.safeParse(c.valeur);
    const attendu = AUTOTEST ? !c.doitPasser : c.doitPasser;
    if (analyse.success === attendu) {
      ok("③ contrat Zod", c.quoi, c.doitPasser ? "accepté" : "refusé");
    } else {
      ko("③ contrat Zod", c.quoi, `attendu ${attendu ? "accepté" : "refusé"}, obtenu l'inverse`);
    }
  }

  // 🔴 ET LA TRANSFORMATION EST VÉRIFIÉE, PAS SEULEMENT L'ACCEPTATION : un champ facultatif
  // vide doit valoir `null` et jamais `''`. Sans cette garde, la chaîne vide arriverait à la
  // base, où le `CHECK` la refuserait — le bénévole recevrait une erreur de driver pour un
  // champ qu'il a simplement laissé vide.
  const vide = workshopInputSchema.safeParse({ title: "Valide", family: "atelier", summary: "" });
  if (vide.success && vide.data.summary === null) {
    ok("③ contrat Zod", "champ facultatif vide", "transformé en null (et non en chaîne vide)");
  } else {
    ko("③ contrat Zod", "champ facultatif vide", "n'est pas transformé en null");
  }
}

// ── ④  LES TROIS FAMILLES DE L'ENUM ONT TOUTES UN LIBELLÉ PUBLIC ──────────────────────
//
// ⚠️ Le typecheck l'impose déjà (`Record<WorkshopFamily, string>` exhaustif). Cette garde
// existe pour le cas que le typecheck NE voit pas : une valeur ajoutée à l'enum **en base**
// par une migration, sans passer par le tableau TypeScript. Elle rendrait un titre de famille
// vide sur la page publique.
{
  const familles = await sql<{ valeur: string }[]>`
    select enumlabel as valeur from pg_enum
    where enumtypid = 'workshop_family'::regtype
    order by enumsortorder`;
  const enBase = familles.map((f) => f.valeur);
  const enCode = [...WORKSHOP_FAMILIES];

  if (JSON.stringify(enBase) === JSON.stringify(enCode)) {
    ok("④ enum ↔ code", "workshop_family", `mêmes valeurs ET même ORDRE : ${enBase.join(", ")}`);
  } else {
    ko("④ enum ↔ code", "workshop_family", `base [${enBase.join(", ")}] ≠ code [${enCode.join(", ")}]`);
  }

  const sansLibelle = enBase.filter((f) => !(f in LIBELLES_FAMILLE));
  if (sansLibelle.length === 0) {
    ok("④ enum ↔ code", "libellés publics", "chaque famille de la base a son libellé");
  } else {
    ko("④ enum ↔ code", "libellés publics", `sans libellé : ${sansLibelle.join(", ")}`);
  }
}

// ── ⑤  AUCUN ATELIER NON PUBLIÉ DANS LE HTML PUBLIC ───────────────────────────────────
//
// 🔴 ON N'INVENTE PAS UN MARQUEUR : on crée une ligne NON PUBLIÉE au titre improbable, on
// demande la page publique, et on vérifie que ce titre n'y apparaît pas. C'est une mesure
// d'EFFET, pas une lecture de code.
{
  const temoin = `ZZ-Temoin-Porte-${Date.now().toString(36)}`;
  await sql`insert into workshop (title, family, is_published) values (${temoin}, 'atelier', ${AUTOTEST})`;
  try {
    const r = await demander("/animations");
    if (r.corps.includes(temoin)) {
      ko("⑤ brouillon public", "/animations", "le titre d'un atelier NON PUBLIÉ apparaît dans le HTML servi");
    } else {
      ok("⑤ brouillon public", "/animations", "aucun atelier non publié dans le HTML servi");
    }
  } finally {
    await sql`delete from workshop where title = ${temoin}`;
  }
}

// ── ⑥  LA BASE REFUSE CE QUE ZOD REFUSE — écritures SQL directes, hors de tout schéma ──
//
// 🔴 CHAQUE LIGNE CI-DESSOUS DOIT ÉCHOUER. Un `UPDATE` direct, une restauration de sauvegarde
// ou une migration de données ne passent par AUCUN schéma Zod : la base est le garde-fou qu'on
// ne peut pas contourner.
// ⚠️ Rappel de la 6.3 : **un `CHECK` qui vaut `NULL` PASSE**. Les branches `is null or …` sont
// donc éprouvées telles quelles, sur le cas « colonne nulle » (voir les contre-épreuves ⑦).
// ⚠️ Chaque cas reçoit `tx` en paramètre — leçon de `gate:partenaires`, où des fabriques
// `() => sql\`…\`` exécutées dans `sql.begin` demandaient une SECONDE connexion à un pool
// `max: 1` : interblocage, et une porte qui ne rendait AUCUN verdict.
type EcritureRefusee = {
  quoi: string;
  contrainte: string;
  ecrire: (tx: postgres.TransactionSql) => Promise<unknown>;
};

const ECRITURES_REFUSEES: EcritureRefusee[] = [
  {
    quoi: "title vide",
    contrainte: "workshop_title_valide",
    ecrire: (tx) => tx`insert into workshop (title, family) values ('', 'atelier')`,
  },
  {
    quoi: "title de blancs ASCII",
    contrainte: "workshop_title_valide",
    ecrire: (tx) => tx`insert into workshop (title, family) values ('   ', 'atelier')`,
  },
  {
    quoi: `title à ${TITRE_MAX + 1}`,
    contrainte: "workshop_title_valide",
    ecrire: (tx) =>
      tx`insert into workshop (title, family) values (${"a".repeat(TITRE_MAX + 1)}, 'atelier')`,
  },
  {
    quoi: "summary NON NULL mais vide",
    contrainte: "workshop_summary_valide",
    ecrire: (tx) => tx`insert into workshop (title, family, summary) values ('T', 'atelier', '')`,
  },
  {
    quoi: `summary à ${RESUME_MAX + 1}`,
    contrainte: "workshop_summary_valide",
    ecrire: (tx) =>
      tx`insert into workshop (title, family, summary) values ('T', 'atelier', ${"a".repeat(RESUME_MAX + 1)})`,
  },
  {
    quoi: "audience NON NULL mais vide",
    contrainte: "workshop_audience_valide",
    ecrire: (tx) => tx`insert into workshop (title, family, audience) values ('T', 'atelier', '  ')`,
  },
  {
    quoi: `audience à ${PUBLIC_MAX + 1}`,
    contrainte: "workshop_audience_valide",
    ecrire: (tx) =>
      tx`insert into workshop (title, family, audience) values ('T', 'atelier', ${"a".repeat(PUBLIC_MAX + 1)})`,
  },
  {
    quoi: "famille absente de l'enum",
    contrainte: "22P02",
    ecrire: (tx) => tx`insert into workshop (title, family) values ('T', 'conference')`,
  },
  {
    quoi: "famille NULL",
    contrainte: "23502",
    ecrire: (tx) => tx`insert into workshop (title) values ('T')`,
  },
  {
    quoi: "title NULL",
    contrainte: "23502",
    ecrire: (tx) => tx`insert into workshop (family) values ('atelier')`,
  },
];

// En autotest, on remplace les écritures par une qui DOIT réussir : si la garde reste verte
// alors qu'on lui présente un succès, elle ne mesure rien.
const ECRITURES_EPROUVEES: EcritureRefusee[] = AUTOTEST
  ? [
      {
        quoi: "AUTOTEST — écriture parfaitement valide",
        contrainte: "aucune",
        ecrire: (tx) => tx`insert into workshop (title, family) values ('Autotest', 'atelier')`,
      },
    ]
  : ECRITURES_REFUSEES;

for (const cas of ECRITURES_EPROUVEES) {
  try {
    await sql.begin(async (tx) => {
      await cas.ecrire(tx);
      // Si on arrive ici, la base a ACCEPTÉ ce qu'elle devait refuser.
      throw new Error("__ACCEPTE__");
    });
    ko("⑥ écriture refusée", cas.quoi, `ACCEPTÉE par la base (attendu : refus ${cas.contrainte})`);
  } catch (erreur) {
    const details = erreur as { message?: string; code?: string; constraint_name?: string };
    if (details.message === "__ACCEPTE__") {
      ko("⑥ écriture refusée", cas.quoi, `ACCEPTÉE par la base (attendu : refus ${cas.contrainte})`);
    } else {
      const vu = details.constraint_name ?? details.code ?? "?";
      ok("⑥ écriture refusée", cas.quoi, `refusée par ${vu}`);
    }
  }
}

// ── ⑦  CONTRE-ÉPREUVES : CE QUI DOIT PASSER PASSE ─────────────────────────────────────
//
// 🔴 SANS ELLES, UNE CONTRAINTE TROP LARGE SERAIT INDISCERNABLE D'UNE CONTRAINTE JUSTE : une
// règle qui refuse TOUT ferait passer la garde ⑥ en entier. Les valeurs « pile à la borne »
// sont incluses, parce que c'est là que se logent les erreurs de `<` contre `<=`.
{
  const CONTRE_EPREUVES: { quoi: string; ecrire: (tx: postgres.TransactionSql) => Promise<unknown> }[] = [
    {
      quoi: "minimal (title + family)",
      ecrire: (tx) => tx`insert into workshop (title, family) values ('Contre-epreuve', 'atelier')`,
    },
    {
      quoi: `title PILE à ${TITRE_MAX}`,
      ecrire: (tx) =>
        tx`insert into workshop (title, family) values (${"a".repeat(TITRE_MAX)}, 'sensibilisation')`,
    },
    {
      quoi: `summary PILE à ${RESUME_MAX}`,
      ecrire: (tx) =>
        tx`insert into workshop (title, family, summary) values ('T', 'evenement', ${"a".repeat(RESUME_MAX)})`,
    },
    {
      quoi: `audience PILE à ${PUBLIC_MAX}`,
      ecrire: (tx) =>
        tx`insert into workshop (title, family, audience) values ('T', 'atelier', ${"a".repeat(PUBLIC_MAX)})`,
    },
    {
      // 🔴 LA BRANCHE `is null` DES DEUX CONTRAINTES NULLABLES, ÉPROUVÉE EXPLICITEMENT.
      // C'est le cas exact où `event_has_venue` s'évaluait à NULL et passait sans rien
      // garder : ici, `NULL` DOIT passer, et c'est voulu — mais il faut l'avoir VU passer.
      quoi: "summary et audience explicitement NULL",
      ecrire: (tx) =>
        tx`insert into workshop (title, family, summary, audience) values ('T', 'atelier', null, null)`,
    },
    {
      quoi: "sortOrder négatif (épinglage en tête)",
      ecrire: (tx) =>
        tx`insert into workshop (title, family, sort_order) values ('T', 'atelier', -5)`,
    },
  ];

  for (const cas of CONTRE_EPREUVES) {
    try {
      await sql.begin(async (tx) => {
        await cas.ecrire(tx);
        throw new Error("__ROLLBACK__");
      });
      ko("⑦ contre-épreuve", cas.quoi, "la transaction n'a pas été annulée (défaut d'instrument)");
    } catch (erreur) {
      const details = erreur as { message?: string; constraint_name?: string; code?: string };
      if (details.message === "__ROLLBACK__") {
        ok("⑦ contre-épreuve", cas.quoi, "acceptée par la base");
      } else {
        const vu = details.constraint_name ?? details.code ?? "?";
        ko("⑦ contre-épreuve", cas.quoi, `REFUSÉE par ${vu} — la contrainte est trop large`);
      }
    }
  }
}

// ── ⑧  LA BASE ET ZOD DISENT LA MÊME CHOSE — parité de bornes MESURÉE ─────────────────
//
// 🔴 C'EST L'ASYMÉTRIE QUI A COÛTÉ TROIS MIGRATIONS DE RATTRAPAGE (`0006`, `0008`, `0009`).
// On ne relit pas les deux fichiers, on lit le TEXTE de la contrainte réellement en base et on
// y cherche la borne du schéma Zod. Deux littéraux qui divergeraient seraient invisibles pour
// le typecheck, le build et l'œil.
{
  const bornes: { contrainte: string; borne: number }[] = [
    { contrainte: "workshop_title_valide", borne: TITRE_MAX },
    { contrainte: "workshop_summary_valide", borne: RESUME_MAX },
    { contrainte: "workshop_audience_valide", borne: PUBLIC_MAX },
  ];

  for (const { contrainte, borne } of bornes) {
    const lignes = await sql<{ definition: string }[]>`
      select pg_get_constraintdef(oid) as definition from pg_constraint
      where conrelid = 'workshop'::regclass and conname = ${contrainte}`;

    if (lignes.length === 0) {
      ko("⑧ parité base/Zod", contrainte, "la contrainte N'EXISTE PAS en base");
      continue;
    }
    const definition = lignes[0].definition;
    const attendue = AUTOTEST ? borne + 1 : borne;
    if (new RegExp(`<=\\s*${attendue}\\b`).test(definition)) {
      ok("⑧ parité base/Zod", contrainte, `la base borne bien à ${attendue}, comme Zod`);
    } else {
      ko("⑧ parité base/Zod", contrainte, `Zod borne à ${attendue}, la base dit : ${definition}`);
    }
    // 🔴 ET LA CONTRAINTE DOIT ÊTRE NULL-SAFE quand la colonne est nullable — leçon
    // `event_has_venue`. Une définition sans branche `is null` sur une colonne nullable
    // s'évaluerait à NULL, donc PASSERAIT, sur le cas exact qu'elle interdit.
    //
    // 🔬 CETTE GARDE A ÉTÉ PROUVÉE ROUGE, ET LA PREUVE A APPRIS QUELQUE CHOSE.
    // On a retiré la branche `is null` de `workshop_summary_valide` en base, puis rejoué la
    // porte. Résultat : **seule cette garde-ci est passée au rouge**. La contre-épreuve ⑦
    // « summary et audience explicitement NULL » est restée **VERTE** — et c'est logique, donc
    // grave : avec la contrainte cassée, `CHECK (length(btrim(NULL)) > 0 …)` vaut `NULL`, donc
    // PASSE, donc l'écriture est acceptée, donc la contre-épreuve est satisfaite. **Le défaut
    // rend la contre-épreuve aveugle par construction.**
    // ⇒ On ne peut PAS mesurer la null-safety par une écriture. Il faut LIRE le texte de la
    // contrainte, ce que fait cette garde et elle seule. Ne pas la supprimer en la croyant
    // redondante avec ⑥/⑦ : elle est le seul témoin de ce défaut.
    if (contrainte !== "workshop_title_valide") {
      if (/IS NULL/i.test(definition)) {
        ok("⑧ parité base/Zod", contrainte, "null-safe (branche `is null` explicite)");
      } else {
        ko("⑧ parité base/Zod", contrainte, "colonne NULLABLE sans branche `is null` — le CHECK vaudra NULL, donc PASSERA");
      }
    }
  }
}

// ── ⑨  L'ORDRE DU CATALOGUE EST TOTAL — mesuré, pas relu ──────────────────────────────
//
// 🔴 LE DÉFAUT QU'AUCUNE AUTRE PORTE NE VERRAIT, ET QUI SERAIT IRREPRODUCTIBLE À LA MAIN.
// `/animations` est `force-dynamic` : la requête est rejouée à CHAQUE visite. Si le tri ne
// départage pas tout, deux ateliers de même famille et même `sort_order` — **le cas nominal**
// dès que le back-office laisse le défaut `0` — sortent dans un ordre que Postgres ne garantit
// pas, et le catalogue se réordonne d'une visite à l'autre.
//
// On crée donc le cas pathologique (trois lignes strictement à égalité de famille ET de rang),
// on rejoue la requête plusieurs fois, et on exige la MÊME suite. ⚠️ Ce n'est pas une preuve
// formelle — c'est une mesure, et elle suffit à attraper un `ORDER BY` amputé de ses deux
// derniers termes.
{
  const marque = `ZZ-Ordre-${Date.now().toString(36)}`;
  const titres = [`${marque}-c`, `${marque}-a`, `${marque}-b`];
  try {
    for (const titre of titres) {
      await sql`insert into workshop (title, family, sort_order, is_published)
                values (${titre}, 'atelier', 0, true)`;
    }

    // Le tri EXACT de `queries/workshops.ts`. En autotest on l'ampute de ses deux derniers
    // termes : la garde doit alors être capable de voir le problème.
    const suites: string[][] = [];
    for (let essai = 0; essai < 5; essai++) {
      const lignes = AUTOTEST
        ? await sql<{ title: string }[]>`
            select title from workshop where title like ${marque + "%"}
            order by family, sort_order`
        : await sql<{ title: string }[]>`
            select title from workshop where title like ${marque + "%"}
            order by family, sort_order, title, id`;
      suites.push(lignes.map((l) => l.title));
    }

    const premiere = JSON.stringify(suites[0]);
    const stable = suites.every((s) => JSON.stringify(s) === premiere);
    // Un ordre TOTAL sur ces trois lignes est nécessairement l'ordre alphabétique des titres
    // (même famille, même rang) : c'est ce qui rend la garde décidable plutôt que tautologique.
    const attendu = JSON.stringify([`${marque}-a`, `${marque}-b`, `${marque}-c`]);

    if (stable && premiere === attendu) {
      ok("⑨ ordre total", "3 ateliers à égalité de famille et de rang", "départagés par le titre, ordre stable sur 5 lectures");
    } else if (!stable) {
      ko("⑨ ordre total", "3 ateliers à égalité", "l'ordre CHANGE d'une lecture à l'autre — le catalogue se réordonnera tout seul");
    } else {
      ko("⑨ ordre total", "3 ateliers à égalité", `ordre non déterministe : ${premiere} ≠ ${attendu}`);
    }
  } finally {
    await sql`delete from workshop where title like ${marque + "%"}`;
  }
}

// ── ⑩  LE SCHÉMA N'A PAS DE COLONNE DE TARIF, DE DURÉE NI D'EFFECTIF ──────────────────
//
// 🔴 L'ABSENCE EST LE LIVRABLE (FR10, FR16), ET C'EST LA SEULE RÈGLE DE CETTE STORY QU'AUCUNE
// RELECTURE NE TIENDRA DANS SIX MOIS. Quelqu'un ajoutera un jour « juste une durée, c'est
// pratique » — et la page bascule d'une offre d'utilité sociale à un catalogue de prestations
// sans qu'aucune porte ne le dise. Celle-ci le dit.
// ⚠️ On lit le SCHÉMA RÉEL de la base, pas le fichier TypeScript : une migration écrite à la
// main ne passerait pas par `schema.ts`.
{
  const INTERDITS = ["prix", "tarif", "cout", "montant", "duree", "effectif", "places", "postes", "participants"];
  const colonnes = await sql<{ nom: string }[]>`
    select column_name as nom from information_schema.columns
    where table_schema = 'public' and table_name = 'workshop'`;
  const noms = colonnes.map((c) => c.nom);

  const cherchees = AUTOTEST ? ["title"] : INTERDITS;
  const trouves = noms.filter((n) => cherchees.some((i) => n.includes(i)));

  if (trouves.length === 0) {
    ok("⑩ FR10/FR16", "colonnes de workshop", `aucune colonne de tarif, durée ni effectif (${noms.length} colonnes)`);
  } else {
    ko("⑩ FR10/FR16", "colonnes de workshop", `colonne(s) interdite(s) : ${trouves.join(", ")} — la page cesserait d'être une offre d'utilité sociale`);
  }
}

// ── ⑪  LA PAGE PUBLIQUE RESTE ENTIÈRE QUAND LE CATALOGUE EST VIDE ─────────────────────
//
// 🔴 L'ÉTAT VIDE EST LE CAS NOMINAL AU MERGE, ET C'EST CE QUI LE REND DANGEREUX : « un état
// tout à zéro ressemble à tout va bien » (leçon 4.2). On vérifie donc que les trois familles
// et la phrase de clôture sont SERVIES, indépendamment du contenu de la table.
{
  const r = await demander("/animations");
  const attendus = AUTOTEST
    ? ["ZZ-Cette-Phrase-N-Existe-Pas"]
    : [...Object.values(LIBELLES_FAMILLE), "se définit avec vous"];
  const manquants = attendus.filter((a) => !r.corps.includes(a));

  if (manquants.length === 0) {
    ok("⑪ page entière", "/animations", "les 3 familles et la phrase de clôture sont servies");
  } else {
    ko("⑪ page entière", "/animations", `absent(s) du HTML servi : ${manquants.join(" · ")}`);
  }
}

// ── ⑬  LE TEXTE SE REPLIE — DÉFAUT RÉEL TROUVÉ EN REVUE, ET `gate` NE LE VOYAIT PAS ───
//
// 🔴 CE QUE CETTE GARDE AJOUTE À LA PORTE `gate`, ET POURQUOI ELLE EXISTE SÉPARÉMENT.
// Les trois champs sont bornés (80 / 200 / 120) mais **rien n'exige un espace** : un intitulé
// de 80 caractères d'un seul tenant est une saisie parfaitement valide, et un copier-coller
// d'URL en produit une sans y penser.
//
// 🔬 MESURÉ AVANT LE CORRECTIF, avec le témoin ci-dessous : à 320px de viewport, le `<li>`
// faisait **248px de boîte pour 2006px de texte** — 1758px de débordement. Après
// `overflow-wrap: anywhere` : **0**.
//
// 🔴 ET `pnpm --filter vitrine gate` EST RESTÉE VERTE SUR CE MÊME TÉMOIN. Ce n'est pas un
// défaut de cette porte-là, c'est sa **définition** : elle balaie les BOÎTES d'éléments contre
// le viewport, or la boîte du `<li>` ne grandit pas — c'est le **texte** qui déborde **de sa
// propre boîte**. Le témoin juste est `element.scrollWidth > element.clientWidth`, mesuré
// **par élément**, ce que fait cette garde-ci.
// ⚠️ À ne pas confondre avec le témoin INTERDIT du projet (`documentElement.scrollWidth ===
// clientWidth`), aveugle sous `overflow-x: clip` : ici la comparaison porte sur un ÉLÉMENT,
// pas sur le document.
// ⚠️ La limitation générale de `gate.mjs` vaut pour **toutes** les pages, pas seulement
// celle-ci → dette **R38**, routée vers la Story 6.10.
{
  const marque = `ZZWRAP${Date.now().toString(36).toUpperCase()}`;
  // 🔴 UN TÉMOIN RÉELLEMENT INSÉCABLE. Première tentative (rejetée) : un titre en
  // `mots-separes-par-des-traits-d-union`. **Le navigateur le coupait proprement** — le trait
  // d'union EST une occasion de coupure en CSS. L'instrument mesurait alors un cas qui n'en
  // était pas un, et rendait un faux vert. Des lettres nues, et rien d'autre.
  const titre = marque + "W".repeat(TITRE_MAX - marque.length);
  await sql`insert into workshop (title, family, sort_order, is_published)
            values (${titre}, 'atelier', 999, true)`;
  try {
    const { launchChrome } = await import("./cdp.mjs");
    const chrome = await launchChrome(9351);
    try {
      const largeurs = [320, 412];
      for (const largeur of largeurs) {
        await chrome.setViewport(largeur, 900);
        await chrome.goto(`${BASE}/animations`);
        // En autotest on neutralise le repli, pour vérifier que la garde SAIT voir le défaut.
        if (AUTOTEST) {
          await chrome.eval(
            `(() => { const s = document.createElement("style");
               s.textContent = "li { overflow-wrap: normal !important }";
               document.head.appendChild(s); return true })()`,
          );
        }
        const mesure = (await chrome.eval(`(() => {
          let pire = 0;
          for (const el of document.querySelectorAll("li")) {
            if (!el.textContent || !el.textContent.includes(${JSON.stringify(marque)})) continue;
            if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth)
              pire = Math.max(pire, el.scrollWidth - el.clientWidth);
          }
          return { pire, vu: document.body.innerText.includes(${JSON.stringify(marque)}) };
        })()`)) as { pire: number; vu: boolean };

        if (!mesure.vu) {
          ko("⑬ repli de ligne", `${largeur}px`, "le témoin n'est pas rendu — la mesure ne dit rien");
        } else if (mesure.pire === 0) {
          ok("⑬ repli de ligne", `${largeur}px`, `un intitulé de ${TITRE_MAX} caractères insécables se replie (0px de débordement)`);
        } else {
          ko("⑬ repli de ligne", `${largeur}px`, `le texte déborde de sa boîte de ${mesure.pire}px — rogné EN SILENCE par overflow-x: clip`);
        }
      }
    } finally {
      await chrome.close();
    }
  } finally {
    await sql`delete from workshop where title like ${marque + "%"}`;
  }
}

// ── ⑫  MÉNAGE : LA PORTE NE LAISSE RIEN DERRIÈRE ELLE ─────────────────────────────────
//
// 🔴 GARDE NÉE D'UN DÉFAUT RÉEL DE `gate:partenaires` : elle POLLUAIT le volume qu'elle
// mesurait, EN RESTANT VERTE. Une porte qui salit ce qu'elle observe finit par mesurer ses
// propres traces.
const apresMenage = await compterAteliers();
if (apresMenage === avantMenage) {
  ok("⑫ ménage", "table workshop", `${avantMenage} → ${apresMenage} ligne(s) : rien laissé derrière`);
} else {
  ko("⑫ ménage", "table workshop", `${avantMenage} → ${apresMenage} ligne(s) : la porte a laissé ${apresMenage - avantMenage} ligne(s)`);
}

await sql.end();

// ══════════════════════════════════════════════════════════════════════════════════════
// EXEMPTIONS — CE QUE CETTE PORTE NE COUVRE PAS, DIT EN SORTIE
// ══════════════════════════════════════════════════════════════════════════════════════
exemptions.add(
  "L'APPARENCE des écrans d'ateliers ET du catalogue public (ton, rythme, hiérarchie) — " +
    "c'est le gate visuel de Brice, et la passe 1 ne s'outille pas (rétro Epic 5).",
);
exemptions.add(
  "🔴 QUE LE CONTENU D'UN ATELIER RESPECTE FR33. Cette porte vérifie les longueurs et les " +
    "familles ; elle ne peut PAS voir qu'une description nomme un partenariat encore en " +
    "discussion. C'est un garde-fou ÉDITORIAL, posé au point de saisie.",
);
exemptions.add(
  "🔴 QU'UN TARIF SOIT ÉCRIT DANS LA DESCRIPTION. La garde ⑩ interdit une COLONNE de tarif ; " +
    "elle ne peut rien contre « 50 € la séance » tapé dans le champ libre. C'est le rappel du " +
    "formulaire qui le couvre, et lui seul.",
);
exemptions.add(
  "La COMPOSITION des Server Actions (rang calculé dans la famille, concurrence optimiste, " +
    "changement de famille qui replace en fin de liste). Ces chemins exigent une session : " +
    "ils sont couverts par le gate visuel, pas ici.",
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
console.log(`  🧹 table workshop : ${avantMenage} → ${apresMenage} ligne(s) après ménage.`);

if (AUTOTEST) {
  if (echecs.length === 0) {
    console.log("\n🔴 AUTO-VALIDATION ÉCHOUÉE — chaque garde a reçu un cas qu'elle devait voir,");
    console.log("   et la porte reste verte. L'instrument ne mesure rien : ne pas s'y fier.");
    process.exit(1);
  }
  console.log(`\n✅ INSTRUMENT VALIDE — ${echecs.length} garde(s) ont vu le cas qu'on leur présentait.`);
  // 🔴 ET CE QUE L'AUTOTEST NE PROUVE PAS EST DIT ICI. Une auto-validation qui ne déclare pas
  // sa propre couverture laisse croire que TOUTES les gardes sont éprouvées — c'est la forme
  // la plus discrète de `pieges/instrument-non-valide.md` : un instrument qui se valide à
  // moitié et l'annonce comme un succès entier.
  console.log("\n   ⚠️  QUATRE GARDES N'ONT PAS DE CAS D'AUTO-VALIDATION, et ce n'est pas un oubli :");
  console.log("      · ② pas de fuite — la route témoin (/admin/login) ne PORTE aucun marqueur");
  console.log("        d'administration : lui en présenter un demanderait d'en fabriquer un faux,");
  console.log("        donc de valider une chaîne inventée plutôt que la garde.");
  console.log("      · ④ enum ↔ code — l'inverser exigerait une migration d'enum dans une porte.");
  console.log("      · ⑦ contre-épreuves — elles SONT déjà l'inverse de ⑥ : les inverser à leur");
  console.log("        tour reviendrait à ré-exécuter ⑥.");
  console.log("      · ⑫ ménage — son cas d'échec est une fuite réelle, qu'on ne provoque pas exprès.");
  console.log("      ⇒ Leur verdict vert repose sur leur lecture, pas sur une mesure d'échec.");
  process.exit(0);
}

if (echecs.length > 0) {
  console.log(`\n🔴 ${echecs.length} GARDE(S) EN ÉCHEC.`);
  process.exit(1);
}
console.log(`\n✅ ${succes.length} GARDE(S) VERTE(S).`);
process.exit(0);
