// @porte surface=agenda effet=base story=6.3
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
//   la section « Déjà passé » disparaît si `getPastEvents` régresse (R50)    ❌          ❌       ❌   ❌
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
// ⚠️ La moitié B écrit dans la base. Ses écritures vivent en transaction ROLLBACK, et elle
// procède par INSERT et non par UPDATE — un `UPDATE` sur une table vide affecte zéro ligne, ne
// déclenche aucun `CHECK`, et rendrait un VERT qui ne mesure rien.
//
// 🔴 UNE EXCEPTION, ET ELLE EST ICI PARCE QU'UN LECTEUR S'ARRÊTE À CET EN-TÊTE. Ce bloc disait
// « **chaque** écriture vit dans une transaction ROLLBACK : rien n'est jamais laissé derrière »
// — devenu **FAUX** avec la garde ⑫ (Story 7.11), qui **COMMITE** deux événements publiés le
// temps de les voir servis en HTTP. Seule la garde ⑫ s'en expliquait, 250 lignes plus bas.
// Corrigé en revue : la garde ⑫ commite, sous préfixe `ZZ-GATE-AGENDA-`, avec balayage des
// orphelins **au démarrage** et ménage prouvé par recompte.
//
// Usage :  pnpm --filter vitrine gate:agenda [baseUrl]
//          AGENDA_AUTOTEST=1 …        → auto-validation de l'instrument (voir plus bas)
//          AGENDA_DEBRANCHER_R50=1 …  → auto-validation de la SEULE garde ⑫ (voir son bloc)
import postgres from "postgres";

import { PAGES, BASE as BASE_DEFAUT } from "./config.mjs";
import {
  diagnostiquerHeureMurale,
  parisWallClockFromInput,
  toInputValue,
} from "../../src/lib/date-paris";
import {
  RECAP_MAX,
  TARIF_MAX,
  TITRE_MAX,
  barInputSchema,
  eventInputSchema,
} from "../../src/lib/schemas/event";
import { lireDatabaseUrl } from "./env.mjs";

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
// BASE — la résolution vit dans `./env.mjs` depuis la Story 7.11
// ══════════════════════════════════════════════════════════════════════════════════════
// ⚠️ Ce bloc portait sa propre copie, sous un TROISIÈME nom (`lireDatabaseUrl`). Elle avait
// la bonne sémantique — mais c'est précisément le problème : **sept copies, deux
// comportements, trois noms**, donc rien à quoi se fier de l'extérieur. Voir `./env.mjs`.

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
  // ── Story 9.6 : le tarif et l'heure de fin ──
  { libelle: "tarif blanc", requete: INSERT_EVENT(", price_text", `, '   '`) },
  {
    libelle: `tarif de ${TARIF_MAX + 1} caractères`,
    requete: INSERT_EVENT(", price_text", `, repeat('a', ${TARIF_MAX + 1})`),
  },
  {
    libelle: "fin AVANT le début",
    requete: INSERT_EVENT(", ends_at", `, now() - interval '2 hours'`),
  },
  {
    // ⚠️ L'ÉGALITÉ EST UN CAS À PART, et elle est refusée : un rendez-vous qui finit à la
    // minute où il commence n'est pas un rendez-vous, c'est une saisie ratée (le plus souvent
    // la date de début recopiée telle quelle). Sans ce cas, un `>=` posé par erreur passerait.
    libelle: "fin ÉGALE au début",
    requete: `INSERT INTO event (title, starts_at, venue_name, ends_at) SELECT 'Porte agenda', t, 'Lieu de contrôle', t FROM (SELECT now() AS t) s`,
  },
];

/** Cas symétriques : chacun DOIT être accepté — une porte qui refuse tout ne mesure rien. */
const ECRITURES_A_ACCEPTER: { libelle: string; requete: string }[] = [
  {
    libelle: `titre de ${TITRE_MAX} caractères (la borne elle-même)`,
    requete: `INSERT INTO event (title, starts_at, venue_name) VALUES (repeat('a', ${TITRE_MAX}), now(), 'Lieu')`,
  },
  { libelle: "compte-rendu absent (NULL)", requete: INSERT_EVENT("", "") },
  // 🔴 Story 9.6 — LE FACULTATIF **EST** LE LIVRABLE (A5), donc il se prouve. Une garde qui ne
  // vérifierait que les refus ci-dessus resterait verte le jour où `ends_at` deviendrait
  // obligatoire, c'est-à-dire le jour où l'on casserait précisément ce que la story livre.
  { libelle: "AUCUNE fin (le livrable de la 9.6)", requete: INSERT_EVENT("", "") },
  {
    libelle: "fin APRÈS le début",
    requete: INSERT_EVENT(", ends_at", `, now() + interval '3 hours'`),
  },
  {
    libelle: "fin LE LENDEMAIN (une soirée qui passe minuit)",
    requete: INSERT_EVENT(", ends_at", `, now() + interval '1 day'`),
  },
  {
    libelle: `tarif de ${TARIF_MAX} caractères (la borne elle-même)`,
    requete: INSERT_EVENT(", price_text", `, repeat('a', ${TARIF_MAX})`),
  },
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

// ── ⑫  LE TEXTE DES DEUX CONTRAINTES NEUVES EST LU (Story 9.6) ─────────────────────
//
// 🔴 LES ÉCRITURES CI-DESSUS NE SUFFISENT PAS, ET C'EST UNE LEÇON PAYÉE ROUGE
// (`gate:ateliers` ⑧) : la null-safety d'un `CHECK` ne se mesure **PAS** par une écriture,
// parce qu'un `CHECK` qui vaut `NULL` **PASSE**. Avec la branche `is null` retirée, la
// contre-épreuve « colonne à `NULL` » resterait **VERTE** — aveugle par construction. Le seul
// témoin est le TEXTE de la contrainte.
//
// ⚠️ ET LE DANGER N'EST PAS OÙ ON L'ATTEND, d'où ce paragraphe : `starts_at` est `notNull`,
// donc `ends_at > starts_at` ne peut valoir `NULL` que si `ends_at` l'est — cas déjà
// court-circuité par la branche de gauche. `event_fin_apres_debut` est donc null-safe **par
// construction**, comme `tournament_podium_sans_trou_2`, et un `coalesce` ajouté par mimétisme
// avec `event_has_venue` serait une garde qui ne garde rien. Ce qu'on exige ici est la
// **présence de la branche `is null`** et la **stricte** inégalité — pas un `coalesce`.
{
  const CONTRAINTES = [
    { nom: "event_fin_apres_debut", motif: /IS NULL/i, quoi: "branche `is null` explicite" },
    { nom: "event_price_text_valide", motif: /IS NULL/i, quoi: "branche `is null` explicite" },
  ];

  for (const c of CONTRAINTES) {
    const lignes = await sql<{ definition: string }[]>`
      select pg_get_constraintdef(oid) as definition from pg_constraint
      where conrelid = 'event'::regclass and conname = ${c.nom}`;

    if (lignes.length === 0) {
      ko("⑫ null-safety lue", c.nom, "la contrainte N'EXISTE PAS en base");
      continue;
    }
    const definition = lignes[0].definition;
    // En autotest on exige une formule qui n'y est pas : la garde doit le voir.
    const trouve = AUTOTEST ? /coalesce/i.test(definition) : c.motif.test(definition);
    if (trouve) {
      ok("⑫ null-safety lue", c.nom, `${c.quoi} — ${definition}`);
    } else {
      ko(
        "⑫ null-safety lue",
        c.nom,
        `pas de ${c.quoi} : la contrainte vaudra NULL sur le cas qu'elle interdit, donc PASSERA — ${definition}`,
      );
    }
  }

  // La stricte inégalité, qui n'est pas une question de nullité mais de sens : une fin égale au
  // début n'est pas une fin. Les écritures ci-dessus la prouvent aussi — les deux mesures se
  // recoupent volontairement, parce qu'un `CHECK` peut être présent dans le texte et `NOT VALID`
  // dans les faits, ou l'inverse (droppé sur la base réelle sans que le fichier bouge).
  {
    const [ligne] = await sql<{ definition: string }[]>`
      select pg_get_constraintdef(oid) as definition from pg_constraint
      where conrelid = 'event'::regclass and conname = 'event_fin_apres_debut'`;
    if (ligne) {
      const stricte = AUTOTEST ? />=/.test(ligne.definition) : />(?!=)/.test(ligne.definition);
      if (stricte) ok("⑫ null-safety lue", "event_fin_apres_debut", "inégalité STRICTE");
      else ko("⑫ null-safety lue", "event_fin_apres_debut", `non stricte : ${ligne.definition}`);
    }
  }
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

// ══════════════════════════════════════════════════════════════════════════════════════
// ⑫ LA DÉRIVATION « À VENIR / DÉJÀ PASSÉ » EST MESURÉE SUR LE RENDU — SOLDE LA DETTE R50
// ⚠️ NUMÉROTÉE ⑫ ET NON ⑥ : une première version portait ⑥, déjà pris par « ⑥ date sans
// fuseau » plus bas dans ce fichier. Deux gardes sans rapport partageaient le même numéro, et
// une même exécution produisait deux blocs `⑥` — le verdict global restait juste, la lecture
// humaine devenait ambiguë. Trouvé en revue (Blind Hunter) ; la sortie l’affichait pourtant.
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 LE TROU QU'ELLE FERME, ET IL EST SILENCIEUX PAR CONSTRUCTION. `gate:carousel` conclut
// « rien à mesurer » quand la section « Déjà passé » est absente du HTML — parce qu'une base
// sans événement passé publié est un état parfaitement légitime (c'est le correctif de R46,
// qui a supprimé un faux POSITIF). Mais l'absence de la section a **deux causes possibles**,
// et le rendu ne les distingue pas :
//     ① aucun événement passé publié      → rien à mesurer, la porte a raison de se taire ;
//     ② `getPastEvents` a régressé        → il y a un DÉFAUT, et la porte se tait pareil.
// ⇒ Un faux NÉGATIF. `CAROUSEL_FORCER_DONNEES=1` ne le comble pas : il prouve que la porte
// sait crier sur « 0 vignette », pas que la dérivation SQL est fiable quand elle prétend
// n'avoir rien à montrer.
//
// La seule parade est de **fabriquer la donnée** : si un événement passé publié existe et que
// la section reste absente, ce n'est plus ambigu — c'est ②.
//
// 🔴 CE BLOC EST LE SEUL DE CE FICHIER QUI **COMMITE**, et c'est une nouveauté assumée. Tout
// le reste vit en transaction ROLLBACK (voir l'en-tête). Ici c'est impossible : une écriture
// annulée n'est **jamais servie en HTTP** — le serveur interroge la base dans une autre
// connexion. Contreparties, toutes tenues : préfixe `ZZ-GATE-` reconnaissable d'un coup d'œil
// par un humain, ménage dans un `finally`, et **le ménage se prouve par un recompte**, pas par
// la présence du `finally` (`pieges/faux-succes.md`).
//
// ⚠️ DEUX TÉMOINS, ET LE SECOND N'EST PAS DÉCORATIF : un seul témoin passé prouverait « il
// apparaît », ce qui resterait vrai d'une page qui afficherait TOUT. Le témoin daté dans le
// FUTUR doit se trouver **avant** le marqueur de section, celui daté dans le PASSÉ **après** —
// c'est la seule mesure qui prouve qu'un événement tombe dans la BONNE section. Patron : la
// garde ⑭ de `gate:tournois`, dont ce bloc est l'application à `event`.
//
// ⚠️ ±1 JOUR, ET C'EST UN CHOIX MESURÉ (repris de la garde ⑭) : assez loin de `now()` pour que
// la frontière `lte`/`gt` ne dépende pas du temps de trajet HTTP, assez près pour rester en
// tête de liste malgré la borne des lectures publiques.
{
  // 🔴 DEUX PRÉFIXES, ET LA DISTINCTION EST UN CORRECTIF DE REVUE (Blind Hunter).
  // `MARQUE` porte un horodatage, donc il est UNIQUE à chaque exécution — parfait pour ne pas
  // confondre deux runs, **inutilisable** pour retrouver ce qu'un run précédent a laissé.
  // Or ce bloc COMMITE des événements `is_published = true` : si le processus meurt entre
  // l'`INSERT` et le `DELETE` (CI tuée, Ctrl-C, coupure pendant le `fetch`), **deux faux
  // jeudis restent affichés sur la page publique**, et aucune exécution future ne pouvait les
  // voir — le recompte cherchait `like MARQUE%`, un préfixe que le run suivant ne connaît pas.
  // ⇒ Le ménage porte sur le préfixe **STABLE**, et il balaie AUSSI au démarrage : une porte
  // qui écrit sur une page publique doit savoir réparer ce qu'une exécution interrompue a
  // laissé, pas seulement ce qu'elle vient de créer.
  const PREFIXE_STABLE = "ZZ-GATE-AGENDA-";
  const MARQUE = `${PREFIXE_STABLE}${Date.now()}`;
  const titrePasse = `${MARQUE}-PASSE`;
  const titreAVenir = `${MARQUE}-A-VENIR`;

  // L'`id` du `<h2>` de la section, porté par `aria-labelledby` : il tient l'accessibilité,
  // donc le supprimer casserait le rendu bien avant de casser cette mesure. Volontairement
  // PAS un nom de classe CSS Module, dont le hash change à chaque édition du fichier.
  const MARQUEUR_SECTION_PASSES = 'id="passes-title"';

  // Balayage d'entrée : des orphelins ici ne sont PAS une anomalie de la base, c'est la trace
  // d'une exécution précédente interrompue. On le dit, on répare, et on continue.
  const orphelins = await sql<{ id: string }[]>`
    delete from event where title like ${PREFIXE_STABLE + "%"} returning id`;
  if (orphelins.length > 0) {
    console.log(
      `  🧹 ${orphelins.length} témoin(s) ZZ-GATE-AGENDA- ORPHELIN(S) d'une exécution interrompue — supprimé(s).\n`,
    );
  }

  const ids: string[] = [];
  try {
    // 🔬 AUTO-VALIDATION DE CETTE GARDE (`pieges/instrument-non-valide.md`).
    //
    // Le défaut que ⑫ vise (`getPastEvents` qui régresse) vit dans le code **servi par
    // staging** : le casser exigerait un redéploiement, c'est-à-dire abîmer l'hôte que la
    // porte mesure. On fabrique donc son **EFFET**, qui est identique et observable : le
    // témoin « passé » est daté dans le FUTUR, donc plus aucun événement passé publié
    // n'existe et la section « Déjà passé » disparaît — exactement ce que produirait un
    // `lte` devenu `lt`, ou un filtre `is_published` cassé.
    // ⚠️ Une garde dont on n'a jamais vu l'échec ne prouve pas qu'elle mesure quelque chose,
    // et celle-ci existe précisément parce qu'un SILENCE était pris pour un succès (R50).
    const DEBRANCHER_R50 = process.env.AGENDA_DEBRANCHER_R50 === "1";
    if (DEBRANCHER_R50) {
      console.log(
        "  ⚠️  AGENDA_DEBRANCHER_R50=1 — le témoin « passé » est daté dans le FUTUR, un ÉCHEC de ⑫ est ATTENDU\n",
      );
      // 🔴 L'AUTO-VALIDATION REPOSE SUR UNE HYPOTHÈSE — ALORS ON LA MESURE (revue, Blind
      // Hunter). Simuler la panne consiste à faire disparaître le SEUL événement passé publié.
      // Si la base en contient de VRAIS, la section « Déjà passé » reste présente, ⑫ reste
      // verte, et l'auto-validation conclurait à tort que la garde ne sait pas échouer — ou
      // pire, ferait croire qu'elle a été éprouvée alors qu'elle ne l'a pas été.
      // ⚠️ C'est exactement le motif de la sonde de données de `gate:carousel` : une porte doit
      // savoir distinguer « je ne peux pas mesurer » de « j'ai mesuré ».
      const [reels] = await sql<{ n: number }[]>`
        select count(*)::int as n from event
        where is_published = true and starts_at <= now()
          and title not like ${PREFIXE_STABLE + "%"}`;
      if (reels.n > 0) {
        console.log(
          `  ⛔ AUTO-VALIDATION NON CONCLUANTE : ${reels.n} événement(s) passé(s) publié(s) RÉELS\n` +
            "     existent, donc la section « Déjà passé » restera présente quoi qu'il arrive.\n" +
            "     Le témoin ne peut pas la faire disparaître — ⑫ ne peut pas être éprouvée ici.\n",
        );
      }
    }

    for (const [titre, decalage] of [
      [titrePasse, DEBRANCHER_R50 ? "+2 days" : "-1 day"],
      [titreAVenir, "+1 day"],
    ] as const) {
      const [ligne] = await sql<{ id: string }[]>`
        insert into event (title, venue_name, starts_at, is_published)
        values (${titre}, 'Salle temoin', now() + ${decalage}::interval, true)
        returning id`;
      ids.push(ligne.id);
    }

    // 🔴 LE `fetch` EST ENCADRÉ, ET CE N'EST PAS DE LA PRUDENCE DÉCORATIVE (revue, Edge Case
    // Hunter). Sans ce `catch`, une coupure réseau faisait remonter l'exception hors du bloc :
    // `sql.end()` n'était jamais atteint (connexion qui fuit) et **toutes les gardes de fuseau
    // et de schéma qui suivent — lesquelles n'ont besoin NI du réseau NI de la base — ne
    // s'exécutaient jamais**. Le rapport entier disparaissait au profit d'une trace brute,
    // c'est-à-dire qu'un hoquet réseau annulait la mesure de tout le reste du fichier.
    let html: string | null = null;
    let motifReseau: string | null = null;
    try {
      const reponse = await fetch(BASE + "/agenda");
      // Un `/agenda` en 500 ne fait pas planter le script, mais il rendrait le diagnostic
      // MENSONGER (« la section est absente » au lieu de « le serveur est en erreur »).
      if (!reponse.ok) motifReseau = `/agenda a répondu ${reponse.status}`;
      else html = await reponse.text();
    } catch (erreur) {
      motifReseau = `/agenda injoignable (${(erreur as Error).message})`;
    }

    if (html === null) {
      ko("⑫ dérivation", "/agenda", `${motifReseau} — la dérivation est INÉPROUVABLE`);
    } else {
      const posSection = html.indexOf(MARQUEUR_SECTION_PASSES);
      const posPasse = html.indexOf(titrePasse);
      const posAVenir = html.indexOf(titreAVenir);

      if (posSection === -1) {
        ko(
          "⑫ dérivation",
          "/agenda",
          "un événement PASSÉ PUBLIÉ existe et la section « Déjà passé » est ABSENTE — " +
            "ce n'est plus « rien à mesurer », c'est un défaut de dérivation (R50)",
        );
      } else {
        ok("⑫ dérivation", "/agenda", "la section « Déjà passé » apparaît quand la donnée existe");
      }

      if (posPasse === -1 || posAVenir === -1) {
        ko(
          "⑫a témoins servis",
          "/agenda",
          `passé=${posPasse !== -1}, à venir=${posAVenir !== -1} — un témoin publié n'est pas servi`,
        );
      } else if (posSection === -1) {
        ko("⑫b position", "/agenda", "section absente : la position est inéprouvable");
      } else if (!(posAVenir < posSection && posSection < posPasse)) {
        ko(
          "⑫b position",
          "/agenda",
          `ordre servi à-venir=${posAVenir} · section=${posSection} · passé=${posPasse} — ` +
            "un événement est dans la MAUVAISE section (les deux listes seraient interverties)",
        );
      } else {
        ok(
          "⑫b position",
          "/agenda",
          "le témoin futur est AVANT la section « Déjà passé », le témoin passé APRÈS",
        );
      }
    }
  } finally {
    // 🔴 LE MÉNAGE SE PROUVE, IL NE SE DÉCLARE PAS. On supprime, puis on RECOMPTE : un
    // `delete` qui n'affecte aucune ligne laisserait deux témoins publiés sur une page
    // publique, et le `finally` seul ne le dirait pas.
    //
    // ⚠️ ET LE `DELETE` EST LUI-MÊME ENCADRÉ (revue) : s'il levait — perte de connexion en
    // pleine écriture —, le recompte qui suit ne s'exécutait pas, donc **aucun `ko`**. Les
    // deux témoins `is_published = true` seraient restés sur une page publique **sans le
    // moindre signal**, précisément ce que ce bloc prétend exclure. La preuve par recompte ne
    // vaut que si elle est atteignable sur TOUS les chemins.
    let motifSuppression: string | null = null;
    try {
      if (ids.length > 0) {
        await sql`delete from event where id = any(${ids})`;
      }
    } catch (erreur) {
      motifSuppression = (erreur as Error).message;
    }

    // Le recompte porte sur le préfixe STABLE : il voit donc aussi ce qu'une exécution
    // précédente aurait laissé, et pas seulement les témoins de ce run.
    try {
      const [restants] = await sql<{ n: number }[]>`
        select count(*)::int as n from event where title like ${PREFIXE_STABLE + "%"}`;
      if (restants.n !== 0) {
        ko(
          "⑫c ménage",
          "event",
          `${restants.n} témoin(s) ${PREFIXE_STABLE} SUBSISTENT en base — ils sont PUBLIÉS` +
            (motifSuppression ? ` (suppression en échec : ${motifSuppression})` : ""),
        );
      } else {
        ok("⑫c ménage", "event", `${ids.length} témoin(s) créé(s), 0 restant (recompté)`);
      }
    } catch (erreur) {
      // Dernier filet : si même le recompte est impossible, on ne peut RIEN affirmer — et le
      // dire est la seule conduite honnête. Un silence ici se lirait comme un succès.
      ko(
        "⑫c ménage",
        "event",
        `recompte IMPOSSIBLE (${(erreur as Error).message}) — statut du ménage INCONNU` +
          (motifSuppression ? `, et la suppression avait déjà échoué : ${motifSuppression}` : ""),
      );
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
if (AUTOTEST) {
  // 🔴 UN AUTOTEST MUET SUR SA PROPRE COUVERTURE LAISSE CROIRE QU'IL COUVRE TOUT — règle
  // établie par `gate:ateliers`, et qui manquait ici (trouvée en revue, Edge Case Hunter).
  // `AGENDA_AUTOTEST=1` ne présente AUCUN cas d'échec à la garde ⑫ : elle tourne en mode
  // NORMAL pendant l'auto-validation, donc un rapport « auto-validation réussie » ne dit
  // strictement rien d'elle. Son épreuve a un drapeau SÉPARÉ, et il faut le dire.
  exemptions.add(
    "L'AUTO-VALIDATION de la garde ⑫ (dérivation « à venir / déjà passé ») n'est PAS couverte " +
      "par AGENDA_AUTOTEST=1 : elle a son propre drapeau, AGENDA_DEBRANCHER_R50=1, à lancer " +
      "séparément. Ce rapport ne prouve donc rien sur ⑫.",
  );
}

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
