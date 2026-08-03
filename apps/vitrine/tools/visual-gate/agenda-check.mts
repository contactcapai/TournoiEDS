// 🔬 GARDE DE LA SURFACE DE SAISIE « AGENDA » (Story 6.3) — 12ᵉ instrument du projet.
//
// Pourquoi un contrôle dédié — même motif que `gate:admin` / `gate:solicitation` / `gate:links` :
//
//   défaut possible                                                   lint/build  Lighthouse  gate  œil
//   une route d'agenda accessible sans session                            ❌          ❌       ❌   ⚠️
//   la page est RENDUE puis redirigée → une donnée NON PUBLIÉE a fui       ❌          ❌       ❌   ❌
//   un événement non publié apparaît sur le site public                    ❌          ❌       ❌   ⚠️
//   un `CHECK` absent, mal formé, ou perdu à la prochaine migration        ❌          ❌       ❌   ❌
//   une borne Zod qui diverge de la borne de la base                       ❌          ❌       ❌   ❌
//   `<input datetime-local>` accepté sans conversion → heure fausse en prod ❌          ❌       ❌   ❌
//   l'aller-retour de date se décale d'une heure aux changements d'heure    ❌          ❌       ❌   ❌
//   R23 : une heure pathologique enregistrée en silence                     ❌          ❌       ❌   ❌
//
// 🔴 DEUX MOITIÉS, PARCE QUE LES DEUX RISQUES NE SE MESURENT PAS AU MÊME ENDROIT :
//   A — HTTP NU, sans aucun cookie : ce que le serveur SERT à un inconnu ;
//   B — ÉCRITURES QUI DOIVENT ÉCHOUER, contre la base réelle, plus les contrats Zod/fuseau.
//
// 🔴 ÉCRITE EN TypeScript ET EXÉCUTÉE PAR `tsx`, CONTRAIREMENT AUX ONZE AUTRES PORTES.
// Ce n'est pas une coquetterie : la moitié B doit exercer `eventInputSchema` et
// `date-paris.ts` EUX-MÊMES. Une porte qui réimplémenterait leurs règles en JS validerait
// sa propre copie et resterait verte le jour où le produit divergerait — c'est très
// exactement `pieges/garde-nominale.md` (« vérifier un NOM ne protège pas un CONTRAT »).
//
// ⚠️ La moitié B écrit dans la base de DÉVELOPPEMENT. Chaque écriture vit dans une
// transaction ROLLBACK : rien n'est jamais laissé derrière. Et elle procède par INSERT et
// non par UPDATE — un `UPDATE` sur une table vide affecte zéro ligne, ne déclenche aucun
// `CHECK`, et rendrait un VERT qui ne mesure rien.
//
// Usage :  pnpm --filter vitrine gate:agenda [baseUrl]
//          AGENDA_AUTOTEST=1 …  → auto-validation de l'instrument (voir plus bas)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";

import { PAGES, BASE as BASE_DEFAUT } from "./config.mjs";
import {
  diagnostiquerHeureMurale,
  parisWallClockFromInput,
  toInputValue,
} from "../../src/lib/date-paris";
import { RECAP_MAX, TITRE_MAX, barInputSchema, eventInputSchema } from "../../src/lib/schemas/event";

const BASE = process.argv[2] ?? BASE_DEFAUT;
const AUTOTEST = process.env.AGENDA_AUTOTEST === "1";

const echecs: string[] = [];
const succes: string[] = [];
const exemptions = new Set<string>();
const ko = (garde: string, ou: string, quoi: string) => echecs.push(`${garde} ${ou} — ${quoi}`);
const ok = (garde: string, ou: string, quoi: string) => succes.push(`${garde} ${ou} — ${quoi}`);

// ══════════════════════════════════════════════════════════════════════════════════════
// MOITIÉ A — HTTP NU, SANS AUCUN COOKIE
// ══════════════════════════════════════════════════════════════════════════════════════

/** Un UUID valide, mais qui ne désigne rien : la garde porte sur la ROUTE, pas sur la donnée. */
const UUID_QUELCONQUE = "00000000-0000-4000-8000-000000000000";

const ROUTES_AGENDA = [
  "/admin/agenda",
  "/admin/agenda/nouveau",
  "/admin/agenda/bars",
  `/admin/agenda/${UUID_QUELCONQUE}`,
  `/admin/agenda/${UUID_QUELCONQUE}/apercu`,
  `/admin/agenda/bars/${UUID_QUELCONQUE}`,
];

// En autotest, on présente à la porte une route qu'on SAIT ouverte comme si elle devait
// être protégée. Si les gardes sont réelles, elles échouent. Si elles restent vertes,
// l'instrument ne mesure rien et il ne faut pas se fier à ses verdicts.
const ROUTES_EPROUVEES = AUTOTEST ? ["/admin/login"] : ROUTES_AGENDA;

/** Marqueurs de contenu d'ADMINISTRATION — voir `admin-check.mjs` pour le resserrement. */
const MARQUEURS_ADMIN = [
  "Se déconnecter",
  "Sections du back-office",
  "Créer un événement",
  "Bars du roulement",
  "agenda-module__",
];

async function demander(chemin: string, entetes: Record<string, string> = {}) {
  const reponse = await fetch(BASE + chemin, { redirect: "manual", headers: { ...entetes } });
  return {
    statut: reponse.status,
    emplacement: reponse.headers.get("location"),
    corps: await reponse.text(),
  };
}

const estRedirection = (statut: number) => statut >= 300 && statut < 400;
const versLogin = (emplacement: string | null) =>
  typeof emplacement === "string" && emplacement.includes("/admin/login");

console.log(`\n🔎 Surface de saisie « agenda » — ${BASE}`);
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

// ══════════════════════════════════════════════════════════════════════════════════════
// BASE DE DÉVELOPPEMENT — lecture de DATABASE_URL sans dépendance supplémentaire
// ══════════════════════════════════════════════════════════════════════════════════════

const ICI = dirname(fileURLToPath(import.meta.url));

function lireDatabaseUrl(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const contenu = readFileSync(join(ICI, "..", "..", ".env.local"), "utf8");
    const ligne = contenu.split(/\r?\n/).find((l) => l.trim().startsWith("DATABASE_URL="));
    return ligne ? ligne.slice(ligne.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

const urlBase = lireDatabaseUrl();
if (!urlBase) {
  console.log("🔴 DATABASE_URL introuvable — la moitié B ne peut pas s'exécuter.");
  console.log("   Démarrez le Postgres de dev et renseignez apps/vitrine/.env.local.");
  process.exit(1);
}

const sql = postgres(urlBase, { max: 1, onnotice: () => {} });

/**
 * Exécute une écriture dans une transaction TOUJOURS annulée, et dit si la base l'a REFUSÉE.
 *
 * ⚠️ Le sentinelle de rollback doit être distinguable d'un refus réel, sinon toute écriture
 * serait comptée comme « refusée » et la porte serait verte quoi qu'il arrive.
 */
async function ecritureRefusee(requete: string): Promise<{ refusee: boolean; detail: string }> {
  const SENTINELLE = "ROLLBACK_VOULU_PAR_LA_PORTE";
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

const INSERT_EVENT = (colonnes: string, valeurs: string) =>
  `INSERT INTO event (title, starts_at, venue_name${colonnes}) VALUES ('Porte agenda', now(), 'Lieu de contrôle'${valeurs})`;

/** Cas de la moitié B : chacun DOIT être refusé par la base. */
const ECRITURES_A_REFUSER: { libelle: string; requete: string }[] = [
  {
    libelle: "titre vide",
    requete: `INSERT INTO event (title, starts_at, venue_name) VALUES ('', now(), 'Lieu')`,
  },
  {
    libelle: `titre de ${TITRE_MAX + 1} caractères`,
    requete: `INSERT INTO event (title, starts_at, venue_name) VALUES (repeat('a', ${TITRE_MAX + 1}), now(), 'Lieu')`,
  },
  {
    libelle: `compte-rendu de ${RECAP_MAX + 1} caractères`,
    requete: INSERT_EVENT(", recap", `, repeat('a', ${RECAP_MAX + 1})`),
  },
  { libelle: "compte-rendu blanc", requete: INSERT_EVENT(", recap", `, '   '`) },
  { libelle: "jeux blancs", requete: INSERT_EVENT(", games", `, '  '`) },
  {
    libelle: "événement SANS aucun lieu",
    requete: `INSERT INTO event (title, starts_at) VALUES ('Porte agenda', now())`,
  },
  {
    libelle: "nom de lieu blanc AVEC un bar (hors portée d'event_has_venue)",
    requete: `INSERT INTO event (title, starts_at, bar_id, venue_name) SELECT 'Porte agenda', now(), id, '   ' FROM bar LIMIT 1`,
  },
  {
    libelle: "nom de bar blanc",
    requete: `INSERT INTO bar (name, address, district) VALUES ('   ', 'Rue de contrôle', 'Centre')`,
  },
];

/** Cas symétriques : chacun DOIT être accepté — une porte qui refuse tout ne mesure rien. */
const ECRITURES_A_ACCEPTER: { libelle: string; requete: string }[] = [
  {
    libelle: `titre de ${TITRE_MAX} caractères (la borne elle-même)`,
    requete: `INSERT INTO event (title, starts_at, venue_name) VALUES (repeat('a', ${TITRE_MAX}), now(), 'Lieu')`,
  },
  { libelle: "compte-rendu absent (NULL)", requete: INSERT_EVENT("", "") },
];

// En autotest on ajoute aux « doivent être refusées » une écriture parfaitement VALIDE :
// si la garde ③ reste verte, c'est qu'elle ne mesure rien.
const A_REFUSER = AUTOTEST
  ? [
      ...ECRITURES_A_REFUSER,
      { libelle: "AUTOTEST — écriture valide présentée comme devant échouer", requete: INSERT_EVENT("", "") },
    ]
  : ECRITURES_A_REFUSER;

for (const cas of A_REFUSER) {
  const { refusee, detail } = await ecritureRefusee(cas.requete);
  if (!refusee) ko("③ la base refuse", cas.libelle, `ACCEPTÉE par Postgres — ${detail}`);
  else ok("③ la base refuse", cas.libelle, `refusée (${detail})`);
}

for (const cas of ECRITURES_A_ACCEPTER) {
  const { refusee, detail } = await ecritureRefusee(cas.requete);
  if (refusee) ko("④ la base accepte", cas.libelle, `REFUSÉE alors qu'elle est valide — ${detail}`);
  else ok("④ la base accepte", cas.libelle, detail);
}

// ── ⑤  Aucun événement NON PUBLIÉ ne doit apparaître sur le site public ─────────────
{
  const nonPublies = await sql<{ title: string }[]>`
    SELECT title FROM event WHERE is_published = false LIMIT 20
  `;

  if (nonPublies.length === 0) {
    exemptions.add(
      "Garde ⑤ (aucun événement non publié sur le site public) : la base de dev n'en contient " +
        "AUCUN, la garde n'a donc rien cherché. Elle est VIDE, pas verte.",
    );
  } else {
    for (const page of PAGES) {
      const r = await demander(page);
      if (r.statut !== 200) {
        ko("⑤ rien de non publié", page, `statut ${r.statut} sans cookie (régression FR28)`);
        continue;
      }
      const fuites = nonPublies.map((l) => l.title).filter((t) => r.corps.includes(t));
      if (fuites.length > 0) {
        ko("⑤ rien de non publié", page, `contient ${fuites.map((f) => `« ${f} »`).join(", ")}`);
      } else {
        ok("⑤ rien de non publié", page, `200, et aucun des ${nonPublies.length} brouillons`);
      }
    }
  }
}

await sql.end();

// ══════════════════════════════════════════════════════════════════════════════════════
// MOITIÉ B (suite) — LES CONTRATS Zod ET FUSEAU, EXERCÉS SUR LES VRAIS MODULES
// ══════════════════════════════════════════════════════════════════════════════════════

// ── ⑥  Une date SANS FUSEAU est refusée, et le message dit quoi faire ───────────────
{
  const brut = AUTOTEST ? new Date() : "2026-08-06T19:00";
  const analyse = eventInputSchema.safeParse({
    title: "Contrôle",
    venueName: "Lieu",
    startsAt: brut,
  });

  if (analyse.success) {
    ko(
      "⑥ date sans fuseau",
      "eventInputSchema",
      "une chaîne `datetime-local` NUE est acceptée : l'heure glissera de deux heures en production",
    );
  } else {
    const message = analyse.error.issues.map((i) => i.message).join(" ");
    if (!message.includes("parisWallClock")) {
      ko(
        "⑥ date sans fuseau",
        "eventInputSchema",
        "refusée, mais le message ne dit pas quoi faire — un garde-fou muet se contourne",
      );
    } else {
      ok("⑥ date sans fuseau", "eventInputSchema", "refusée, et le message nomme la parade");
    }
  }
}

// ── ⑦  Aller-retour de date, y compris aux DEUX changements d'heure ─────────────────
{
  // ⚠️ Ces valeurs traversent volontairement les deux bascules ET l'heure d'été/hiver.
  // Les heures PATHOLOGIQUES (02h00–02h59 des jours de bascule) sont exclues : par
  // construction elles ne peuvent PAS faire un aller-retour, c'est tout le sujet de R23,
  // et la garde ⑧ les traite à part.
  const echantillons = [
    "2026-01-15T19:00",
    "2026-03-29T01:30", // avant le saut
    "2026-03-29T04:30", // après le saut
    "2026-08-06T19:00",
    "2026-10-25T01:30", // avant le recul
    "2026-10-25T04:30", // après le recul
    "2026-12-31T23:59",
  ];

  for (const valeur of echantillons) {
    const instant = parisWallClockFromInput(valeur);
    if (instant === null) {
      ko("⑦ aller-retour", valeur, "refusée par `parisWallClockFromInput`");
      continue;
    }
    const retour = toInputValue(instant);
    // En autotest, on compare à une valeur volontairement fausse : la garde doit tirer.
    const attendu = AUTOTEST ? "1999-01-01T00:00" : valeur;
    if (retour !== attendu) {
      ko("⑦ aller-retour", valeur, `revient à ${retour} — l'heure murale ne survit pas`);
    } else {
      ok("⑦ aller-retour", valeur, `identique après conversion (${instant.toISOString()})`);
    }
  }
}

// ── ⑧  R23 : les deux heures pathologiques sont DÉTECTÉES et ANNONCÉES ──────────────
{
  const cas: { valeur: string; attendu: "ok" | "inexistante" | "ambigue" }[] = [
    { valeur: "2026-03-29T02:30", attendu: AUTOTEST ? "ok" : "inexistante" },
    { valeur: "2026-10-25T02:30", attendu: AUTOTEST ? "ok" : "ambigue" },
    { valeur: "2026-08-06T19:00", attendu: "ok" },
  ];

  for (const { valeur, attendu } of cas) {
    const diagnostic = diagnostiquerHeureMurale(valeur);
    if (diagnostic.cas !== attendu) {
      ko("⑧ heure pathologique (R23)", valeur, `diagnostiquée « ${diagnostic.cas} », attendu « ${attendu} »`);
      continue;
    }
    if (diagnostic.cas !== "ok" && !diagnostic.message.includes("enregistré")) {
      ko(
        "⑧ heure pathologique (R23)",
        valeur,
        "détectée, mais le message ne dit pas CE QUI SERA ENREGISTRÉ — avertir sans dire quoi ne sert à rien",
      );
      continue;
    }
    ok("⑧ heure pathologique (R23)", valeur, `« ${diagnostic.cas} »`);
  }
}

// ── ⑨  Une date HORS BORNES ou INEXISTANTE est refusée, pas normalisée en silence ───
{
  // 🔴 GARDES NÉES DE LA REVUE (Edge Case Hunter) — les trois cas étaient ACCEPTÉS.
  // `Date.UTC` reporte tout débordement : c'est une propriété VOULUE de `parisWallClock`
  // (`nextThursdays` s'en sert), donc la garde doit vivre au point de SAISIE.
  //   "2026-13-32T25:99" → 2027-02-02 02:39   (mois 13, jour 32, heure 25, minute 99)
  //   "2026-00-15T19:00" → 2025-12-15 19:00   (mois 00, et diagnostic « ok » : muet)
  //   "2026-02-29T19:00" → 2026-03-01 19:00   (2026 n'est pas bissextile, et muet aussi)
  const aRefuser = AUTOTEST
    ? ["2026-08-06T19:00"] // une date PARFAITEMENT valide, présentée comme devant être refusée
    : ["2026-13-32T25:99", "2026-00-15T19:00", "2026-02-29T19:00", "2026-04-31T19:00"];

  for (const valeur of aRefuser) {
    const instant = parisWallClockFromInput(valeur);
    if (instant !== null) {
      ko("⑨ date impossible", valeur, `ACCEPTÉE, et normalisée en ${toInputValue(instant)}`);
    } else {
      ok("⑨ date impossible", valeur, "refusée");
    }
  }

  // Contre-partie : les dates valides, y compris les deux heures pathologiques, PASSENT.
  for (const valeur of ["2026-08-06T19:00", "2026-03-29T02:30", "2026-10-25T02:30", "2028-02-29T19:00"]) {
    if (parisWallClockFromInput(valeur) === null) {
      ko("⑩ date valide", valeur, "REFUSÉE alors qu'elle existe — la garde ⑨ est trop large");
    } else {
      ok("⑩ date valide", valeur, "acceptée");
    }
  }
}

// ── ⑪  Un texte fait de caractères INVISIBLES n'est pas un texte ────────────────────
{
  // 🔴 GARDE NÉE DE LA REVUE (Edge Case Hunter) : `event.ts` n'utilisait pas
  // `visiblementVide`, contrairement à `partner.ts` et `photo.ts` — et le commentaire de
  // `event_venue_name_valide` AFFIRMAIT le contraire. Un événement sans bar et avec un
  // `venueName` invisible était créable ET publiable : `btrim()` ne retire pas U+200B.
  const INVISIBLE = "\u200B\u200B\u200B"; // ECHAPPEMENTS : en littéral ils seraient illisibles ET refusés par lint
  const cas = [
    { libelle: "titre invisible", valeur: { title: INVISIBLE, venueName: "Salle", startsAt: new Date() } },
    { libelle: "lieu invisible, sans bar", valeur: { title: "Soirée", venueName: INVISIBLE, startsAt: new Date() } },
  ];

  for (const { libelle, valeur } of cas) {
    // En autotest on présente une saisie NORMALE comme devant être refusée.
    const sujet = AUTOTEST ? { title: "Soirée jeux", venueName: "Salle", startsAt: new Date() } : valeur;
    if (eventInputSchema.safeParse(sujet).success) {
      ko("⑪ texte invisible", libelle, "ACCEPTÉ par Zod — un lieu invisible n'est pas un lieu");
    } else {
      ok("⑪ texte invisible", libelle, "refusé par Zod");
    }
  }

  const bar = barInputSchema.safeParse(
    AUTOTEST
      ? { name: "Le Comptoir", address: "12 rue des Mesures", district: "Centre" }
      : { name: INVISIBLE, address: "12 rue des Mesures", district: "Centre" },
  );
  if (bar.success) ko("⑪ texte invisible", "nom de bar invisible", "ACCEPTÉ par Zod");
  else ok("⑪ texte invisible", "nom de bar invisible", "refusé par Zod");
}

// ══════════════════════════════════════════════════════════════════════════════════════

// ✅ L'EXEMPTION R34 A ÉTÉ RETIRÉE PAR LA STORY 6.4, DANS LE MÊME COMMIT QUE LE CORRECTIF.
// Elle disait : « le rendu Déjà passé n'est pas prévisualisé ». Il l'est désormais
// (`PastEvent` extrait, consommé par /agenda ET par l'écran d'aperçu). Laisser l'exemption
// survivre au défaut serait la leçon R33 ② payée une seconde fois — une porte qui déclare
// ne pas couvrir ce qu'elle couvre est aussi trompeuse qu'une porte muette.
// ⚠️ Le compte d'exemptions de cette porte BAISSE donc de 1 : 4 → 3. C'est un témoin.
exemptions.add(
  "Le chemin AUTHENTIFIÉ (créer, éditer, publier, supprimer une fois connecté) — il exige un " +
    "aller-retour Discord avec un humain. Aucune porte ne le remplacera.",
);
exemptions.add(
  "L'APPARENCE des écrans de saisie (ton, rythme, hiérarchie) — c'est le gate visuel de Brice, " +
    "et la passe 1 ne s'outille pas (rétro Epic 5).",
);
exemptions.add(
  "Que chaque nouvelle page d'admin appelle bien sa PROPRE garde : sans cookie le proxy " +
    "redirige AVANT que la page ne s'exécute, la fuite est structurellement inobservable ici " +
    "(exemption héritée de `gate:admin`, et elle vaut pour les 6 stories suivantes).",
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
  `✅ SURFACE DE SAISIE TENUE — ${succes.length} gardes : routes gardées et sans fuite (HTTP nu), ` +
    "contraintes de base éprouvées par des écritures refusées, contrats Zod et fuseau exercés.",
);
