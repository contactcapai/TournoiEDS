// @porte surface=tournois effet=base story=9.1
// 🔬 GARDE DE LA SURFACE « TOURNOIS » (Story 9.1) — 21ᵉ instrument du projet.
//
// Pourquoi un contrôle dédié — et ce que RIEN d'autre ne voit :
//
//   défaut possible                                                   lint/build Lighthouse gate œil
//   une route de tournois accessible sans session                         ❌        ❌      ❌  ⚠️
//   🔴 un `CHECK` qui vaut NULL, donc qui PASSE (leçon `event_has_venue`) ❌        ❌      ❌  ❌
//   🔴 deux tournois à la MÊME adresse publique (unicité perdue)          ❌        ❌      ❌  ❌
//   `tournament` borné dans Zod et PAS dans la base (asymétrie 0006/8/9)  ❌        ❌      ❌  ❌
//   le motif d'adresse JS et le motif SQL qui divergent                   ❌        ❌      ❌  ❌
//   🔴 une colonne de PHASE / d'INSCRIT ajoutée (périmètre A5 rompu)      ❌        ❌      ❌  ❌
//   une liste qui se RÉORDONNE d'une visite à l'autre (tri partiel)       ❌        ❌      ❌  ⚠️
//   🔴 un tournoi BROUILLON servi sur la page publique (Story 9.2)        ❌        ❌      ❌  ❌
//   🔴 les deux sections « à venir » / « passés » INTERVERTIES (9.2)      ❌        ❌      ❌  ⚠️
//   un tournoi servi sur une page publique qui ne doit pas en servir      ❌        ❌      ❌  ⚠️
//   l'adresse d'un tournoi PUBLIÉ redevenue modifiable                    ❌        ❌      ❌  ❌
//
// 🔴 DEUX MOITIÉS, PARCE QUE LES DEUX RISQUES NE SE MESURENT PAS AU MÊME ENDROIT :
//   A — HTTP NU, sans aucun cookie : ce que le serveur SERT à un inconnu ;
//   B — ÉCRITURES QUI DOIVENT ÉCHOUER + CONTRATS EXERCÉS, contre la base réelle.
//
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CETTE PORTE ÉCRIT DANS LA BASE DE **STAGING**, ET C'EST UN ARBITRAGE DE BRICE
// ══════════════════════════════════════════════════════════════════════════════════════
//
// Les six portes de modèle qui la précèdent écrivaient dans le Postgres de DÉVELOPPEMENT.
// Depuis la règle du 2026-08-13 (« plus de serveur ni de Docker local »), il n'y en a plus.
// Arbitrage : la moitié B vise la base `vitrine` de staging — **où des administrateurs de
// l'association saisissent du contenu réel depuis le 2026-08-11, et où AUCUNE sauvegarde ne
// tourne** (dette R5, Story 7.10 non jouée). Le risque a été signalé et accepté.
//
// ⇒ Trois précautions en découlent, et elles ne sont PAS négociables :
//   ① **tout ce qui peut vivre dans une transaction ROLLBACK y vit.** Les gardes ⑥, ⑦, ⑧, ⑨
//      et ⑫ n'engagent donc rien du tout — leurs écritures sont annulées par construction ;
//   ② **une seule chose est réellement COMMITÉE** : le lot témoin (1 événement + 3 tournois)
//      dont la garde ⑭ a besoin pour être visible en HTTP. Il est supprimé dans un `finally`,
//      donc y compris si la porte échoue ou lève.
//      🔴 **NOUVEAU DEPUIS LA STORY 9.2, ET ÇA SE DIT** : deux de ces témoins sont PUBLIÉS et
//      `/tournois` existe désormais — ils sont donc **réellement affichés sur la page publique
//      de staging** pendant les quelques secondes de la mesure. À la 9.1, l'attendu était leur
//      absence partout, et rien n'était visible. C'est précisément ce que la garde ⑭ retournée
//      doit prouver, donc ce n'est pas évitable ; ce qui l'est, c'est de le taire ;
//   ③ **le décompte de ménage porte sur `tournament` ET sur `event`** — la porte fabrique un
//      événement, donc elle doit prouver qu'elle ne l'a pas laissé. C'est la garde née d'un
//      défaut réel de `gate:partenaires`, qui polluait le volume qu'elle mesurait EN RESTANT
//      VERTE.
// ⚠️ Les témoins portent un préfixe **improbable et reconnaissable** (`ZZ-GATE-`) : si l'un
// d'eux survivait à un `kill -9`, un humain doit pouvoir le reconnaître d'un coup d'œil dans
// le back-office et le supprimer sans se demander si c'est de la vraie donnée.
//
// 🔴 ÉCRITE EN TypeScript ET EXÉCUTÉE PAR `tsx`, comme `gate:agenda`, `gate:galerie`,
// `gate:partenaires` et `gate:ateliers`, et pour la même raison : la moitié B doit exercer
// `tournamentInputSchema` LUI-MÊME. Une porte qui réimplémenterait ses règles validerait sa
// propre copie et resterait verte le jour où le produit divergerait
// (`pieges/garde-nominale.md`).
//
// ⚠️ ELLE N'A PAS BESOIN DE `--conditions=react-server` : elle n'importe RIEN de `src/server/`
// (aucun média, aucun `server-only`). Ne pas ajouter le drapeau « par symétrie » — il masquerait
// le jour où un import serveur s'y glisserait.
//
// Usage :  pnpm --filter vitrine gate:tournois [baseUrl]
//          TOURNOIS_AUTOTEST=1 …  → auto-validation de l'instrument
//          DATABASE_URL=…         → prioritaire sur `.env.local` (c'est ainsi qu'on vise staging)
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

import { BASE as BASE_DEFAUT, PAGES } from "./config.mjs";
import { lireVariable } from "./env.mjs";
// ⚠️ IMPORTÉ, JAMAIS RECOPIÉ (garde ⑱) : c'est la constante qui construit le `pgEnum`, le
// schéma Zod ET le contrat n8n. Une liste alignée à la main se désaligne à l'ajout suivant.
import { EVENT_TYPES } from "../../src/lib/schemas/event";
import {
  LIBELLES_ETAT_INSCRIPTION,
  LIBELLES_MODE_INSCRIPTION,
} from "../../src/lib/libelles-tournoi";
import {
  DUREE_MATCH_MAX,
  FORMAT_MAX,
  IDENTIFIANT_MAX,
  JEU_MAX,
  LIEU_MAX,
  LOTS_MAX,
  MOTIF_IDENTIFIANT,
  NOM_MAX,
  PLACES_MAX,
  PODIUM_MAX,
  REGISTRATION_MODES,
  REGISTRATION_STATES,
  URL_MAX,
  fabriquerIdentifiant,
  tournamentInputSchema,
} from "../../src/lib/schemas/tournament";

const BASE = process.argv[2] ?? BASE_DEFAUT;
const AUTOTEST = process.env.TOURNOIS_AUTOTEST === "1";

const echecs: string[] = [];
const succes: string[] = [];
const exemptions = new Set<string>();
const ko = (garde: string, ou: string, quoi: string) => echecs.push(`${garde} ${ou} — ${quoi}`);
const ok = (garde: string, ou: string, quoi: string) => succes.push(`${garde} ${ou} — ${quoi}`);

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE_APP = join(ICI, "..", "..");

/**
 * Préfixe de TOUS les témoins de cette porte — reconnaissable par un humain (voir l'en-tête).
 *
 * 🔴 DEUX PRÉFIXES, ET LA DISTINCTION EST UN CORRECTIF DE LA STORY 7.11 (trouvé en revue).
 * `MARQUE` porte un horodatage : unique à chaque exécution, donc **inutilisable** pour
 * retrouver ce qu'un run précédent a laissé. Or la garde ⑭ **COMMITE** des tournois publiés,
 * visibles sur `/tournois`. Si le processus meurt entre l'`INSERT` et le `DELETE` (CI tuée,
 * Ctrl-C, coupure pendant un `fetch`), les témoins restent affichés **sur une page publique**,
 * et aucune exécution future ne pouvait les voir — le ménage cherchait `like MARQUE%`, un
 * préfixe que le run suivant ne connaît pas.
 * ⇒ Le balayage d'entrée porte sur le préfixe **STABLE**. Une porte qui écrit sur une page
 * publique doit savoir réparer ce qu'une exécution interrompue a laissé, pas seulement ce
 * qu'elle vient de créer.
 * ⚠️ Ce défaut dormait ici depuis la **Story 9.1** ; il a été découvert sur `gate:agenda`, qui
 * avait **hérité** de ce patron. Corrigé aux deux endroits le 2026-08-15.
 */
const PREFIXE_STABLE = "ZZ-GATE-";
const MARQUE = `${PREFIXE_STABLE}${Date.now().toString(36).toUpperCase()}`;

/**
 * La SEULE page publique qui sert des tournois (Story 9.2, arbitrage A20).
 *
 * ⚠️ Elle est nommée **une fois**, ici, et la garde ⑭ l'exclut de son balayage de `PAGES` par
 * cette constante — de sorte que les cinq autres pages restent découvertes par la
 * configuration et pas énumérées à la main. La 9.3 ajoutera `/tournois/<slug>` : cette
 * constante deviendra alors une liste, et c'est le seul endroit à changer.
 */
const PAGE_TOURNOIS = "/tournois";

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

console.log(`\n🔎 Surface « tournois » — ${BASE}`);
if (AUTOTEST) {
  console.log("   MODE AUTO-VALIDATION : on présente à chaque garde un cas qu'elle doit voir.");
}

// ══════════════════════════════════════════════════════════════════════════════════════
// ⓪ SONDE D'ENTRÉE — LE SERVICE RÉPOND-IL ?
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 ACTION **A6 DE LA RÉTRO EPIC 6**, ET ELLE EST NÉE D'UN CAS HUMILIANT : le 2026-08-08, en
// séance de rétro et en corrigeant précisément cette dette, le serveur a été lancé sur le
// MAUVAIS PORT. La porte a chargé la page d'erreur du navigateur et rendu **35 gardes en
// échec** réparties sur 5 pages — un réquisitoire complet contre un produit parfaitement sain.
// Une porte sœur (`gate.mjs`) disait franchement « rien ne répond » ; celle-là n'avait pas de
// sonde. ⇒ **Toute porte qui mesure un service commence par vérifier que le service répond**,
// et le DIT, sinon elle transforme une erreur d'environnement en accusation.
// ⚠️ La sonde vise `/` et non `/admin/tournois` : la seconde redirige (c'est son livrable), et
// on ne saurait pas distinguer « le service redirige bien » de « rien ne répond ».
{
  try {
    const sonde = await fetch(BASE + "/", { redirect: "manual" });
    if (sonde.status >= 500) {
      console.log(`\n🔴 SONDE D'ENTRÉE : ${BASE}/ répond ${sonde.status}.`);
      console.log("   Le service est en erreur — cette porte ne mesurerait que ça. Arrêt.");
      process.exit(1);
    }
    console.log(`   ✅ sonde d'entrée : ${BASE}/ répond ${sonde.status}.`);
  } catch (erreur) {
    console.log(`\n🔴 SONDE D'ENTRÉE : ${BASE}/ est injoignable (${String(erreur)}).`);
    console.log("   Aucune des gardes HTTP ne mesurerait quoi que ce soit. Arrêt.");
    process.exit(1);
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// MOITIÉ A — HTTP NU, SANS AUCUN COOKIE
// ══════════════════════════════════════════════════════════════════════════════════════

/** Un UUID valide, mais qui ne désigne rien : la garde porte sur la ROUTE, pas sur la donnée. */
const UUID_QUELCONQUE = "00000000-0000-4000-8000-000000000000";

const ROUTES_TOURNOIS = [
  "/admin/tournois",
  "/admin/tournois/nouveau",
  `/admin/tournois/${UUID_QUELCONQUE}`,
];

// En autotest, on présente à la porte une route qu'on SAIT ouverte comme si elle devait être
// protégée. Si les gardes sont réelles, elles échouent. Si elles restent vertes, l'instrument
// ne mesure rien et il ne faut pas se fier à ses verdicts.
const ROUTES_EPROUVEES = AUTOTEST ? ["/admin/login"] : ROUTES_TOURNOIS;

/** Marqueurs de CONTENU d'administration — jamais un titre.
 *  ⚠️ Leçon de `gate:admin`, reprise telle quelle : un marqueur pris sur un `<title>` rendrait
 *  la porte rouge sur une redirection parfaitement propre (Next évalue les `metadata` même
 *  quand le rendu s'interrompt). */
const MARQUEURS_ADMIN = [
  "Se déconnecter",
  "Ajouter un tournoi",
  "Cet état ne dit pas si le tournoi est passé",
  "Retirer du site",
  "tournois-module__",
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


// 🔴 L'ENVIRONNEMENT EST PRIORITAIRE SUR `.env.local`, ET C'EST NOUVEAU DEPUIS CETTE STORY.
// Les six portes de modèle antérieures lisaient `.env.local` **seulement** : elles étaient
// écrites quand un Postgres local tournait. Depuis le 2026-08-13 il n'y en a plus, et c'est
// `DATABASE_URL=… pnpm --filter vitrine gate:tournois` qui vise staging. Le repli sur
// `.env.local` reste, pour qu'un poste qui rallumerait une base locale continue de marcher.
// ✅ [Story 7.11] La priorité à `process.env` vivait ICI, à l'appel, et non dans le helper —
// c'est ce qui rendait cette porte pilotable pour une raison **invisible dans le helper**, et
// qui a fait échouer trois tentatives de dérivation. Elle vit maintenant dans `./env.mjs`,
// une fois, pour toutes les portes.
// ⚠️ CE COMMENTAIRE A DIT « comportement inchangé » — **FAUX, corrigé en revue.** L'ancien
// `process.env.DATABASE_URL ?? lireVariable(…)` traitait une variable **définie mais vide**
// comme décisive (`??` ne voit que `null`/`undefined`), donc la porte sortait en criant ; le
// helper, lui, testait `if (process.env[nom])` et retombait **en silence** sur `.env.local`.
// La règle est désormais alignée sur l'ancienne, dans `./env.mjs` : une variable définie fait
// foi, même vide.
const urlBase = lireVariable("DATABASE_URL");
if (!urlBase) {
  console.log("🔴 DATABASE_URL introuvable (ni environnement, ni .env.local).");
  console.log("   La moitié B ne peut pas s'exécuter — et une porte qui sauterait sa moitié");
  console.log("   la plus dure en restant verte serait pire que pas de porte du tout.");
  process.exit(1);
}

// 🔴 ON DIT CONTRE QUELLE BASE ON ÉCRIT, SANS JAMAIS AFFICHER LE MOT DE PASSE. Une porte qui
// écrit dans une base de production doit le rendre visible : c'est le seul moyen qu'un
// « DATABASE_URL oubliée dans le shell » se remarque AVANT les écritures, pas après.
{
  const sansSecret = urlBase.replace(/\/\/[^@]*@/, "//***@");
  console.log(`   🗄️  base visée : ${sansSecret}`);
}

const sql = postgres(urlBase, { max: 1 });

// 🧹 BALAYAGE D'ENTRÉE — voir le bloc de `PREFIXE_STABLE`. Des témoins ici ne sont PAS une
// anomalie de la base : c'est la trace d'une exécution interrompue, et ils sont PUBLIÉS.
// ⚠️ Il porte sur les DEUX tables que cette porte touche, comme le ménage de sortie : la
// précaution ③ de l'en-tête (« le décompte porte sur toutes les tables touchées ») vaut
// autant pour la réparation que pour le ménage.
{
  const orphelinsT = await sql<{ id: string }[]>`
    delete from tournament where name like ${PREFIXE_STABLE + "%"} returning id`;
  const orphelinsE = await sql<{ id: string }[]>`
    delete from event where title like ${PREFIXE_STABLE + "%"} returning id`;
  if (orphelinsT.length + orphelinsE.length > 0) {
    console.log(
      `\n  🧹 ORPHELINS d'une exécution interrompue supprimés : ${orphelinsT.length} tournoi(s), ` +
        `${orphelinsE.length} événement(s) — ils étaient servis sur /tournois.\n`,
    );
  }
}

/** Compte les lignes des DEUX tables que cette porte touche (voir l'en-tête, précaution ③). */
async function compter(): Promise<{ tournois: number; evenements: number }> {
  const [{ n: tournois }] = await sql<
    { n: number }[]
  >`select count(*)::int as n from tournament`;
  const [{ n: evenements }] = await sql<{ n: number }[]>`select count(*)::int as n from event`;
  return { tournois, evenements };
}

const avantMenage = await compter();

// ── ③  LE CONTRAT ZOD EST EXERCÉ LUI-MÊME, PAS RÉIMPLÉMENTÉ ───────────────────────────
//
// 🔴 `tournamentInputSchema` est IMPORTÉ, et c'est le point de l'écriture en TypeScript. Une
// porte qui recopierait ses règles validerait sa propre copie (`pieges/garde-nominale.md`).
{
  /** Le minimum acceptable — sert de base à tous les cas, pour n'en faire varier qu'un. */
  const BASE_VALIDE = {
    eventId: UUID_QUELCONQUE,
    name: "Tournoi valide",
    game: "Counter-Strike 2",
    slug: "tournoi-valide",
    startsAt: new Date("2026-11-21T14:00:00+01:00"),
    registrationMode: "interne" as const,
  };

  const cas: { quoi: string; valeur: unknown; doitPasser: boolean }[] = [
    { quoi: "minimal valide", valeur: BASE_VALIDE, doitPasser: true },
    { quoi: "nom vide", valeur: { ...BASE_VALIDE, name: "" }, doitPasser: false },
    {
      // 🔴 LE CAS QUE LA BASE NE PEUT PAS VOIR : `btrim` ne retire pas U+200B (leçon 6.3).
      // Zod est le SEUL des deux à pouvoir le refuser.
      quoi: "nom de deux caractères INVISIBLES (U+200B)",
      valeur: { ...BASE_VALIDE, name: "​​" },
      doitPasser: false,
    },
    {
      quoi: `nom à ${NOM_MAX + 1}`,
      valeur: { ...BASE_VALIDE, name: "a".repeat(NOM_MAX + 1) },
      doitPasser: false,
    },
    { quoi: "jeu vide", valeur: { ...BASE_VALIDE, game: "" }, doitPasser: false },
    {
      quoi: `jeu à ${JEU_MAX + 1}`,
      valeur: { ...BASE_VALIDE, game: "a".repeat(JEU_MAX + 1) },
      doitPasser: false,
    },
    {
      quoi: "identifiant d'adresse avec une MAJUSCULE",
      valeur: { ...BASE_VALIDE, slug: "Tournoi-Valide" },
      doitPasser: false,
    },
    {
      quoi: "identifiant d'adresse avec un ACCENT",
      valeur: { ...BASE_VALIDE, slug: "tournoi-validé" },
      doitPasser: false,
    },
    {
      quoi: "identifiant d'adresse avec un SLASH (échappement d'URL)",
      valeur: { ...BASE_VALIDE, slug: "tournoi/valide" },
      doitPasser: false,
    },
    {
      quoi: "identifiant d'adresse à tiret de tête",
      valeur: { ...BASE_VALIDE, slug: "-tournoi" },
      doitPasser: false,
    },
    {
      quoi: "identifiant d'adresse à double tiret",
      valeur: { ...BASE_VALIDE, slug: "tournoi--valide" },
      doitPasser: false,
    },
    {
      quoi: `identifiant d'adresse à ${IDENTIFIANT_MAX + 1}`,
      valeur: { ...BASE_VALIDE, slug: "a".repeat(IDENTIFIANT_MAX + 1) },
      doitPasser: false,
    },
    /**
     * ══════════════════════════════════════════════════════════════════════════════════════
     * 🔴 CE CAS ÉTAIT DEVENU VRAI POUR LA MAUVAISE RAISON — TROUVÉ EN REVUE (Story 9.5)
     * ══════════════════════════════════════════════════════════════════════════════════════
     *
     * Il s'écrivait `{ ...BASE_VALIDE, eventId: "" }`, `doitPasser: false`, sous l'étiquette
     * *« événement de rattachement ABSENT (A4 : obligatoire) »*. Depuis la 9.5, `eventId: ""`
     * vaut `null` et n'est **plus** un refus — mais `BASE_VALIDE` ne porte **aucun**
     * `venueName`, donc le `superRefine` neuf refusait la ligne pour « lieu manquant ». Le
     * booléen observé restait `false` : **le même verdict, par un mécanisme entièrement
     * différent.**
     * ⇒ Le cas ne discriminait plus rien. Si quelqu'un remettait `eventId: z.uuid()`
     * obligatoire — c'est-à-dire annulait le livrable de cette story — il serait resté
     * **VERT**. C'est `pieges/garde-nominale.md` par vieillissement : l'étiquette décrivait
     * encore la règle d'hier, le code mesurait celle d'aujourd'hui.
     *
     * ⇒ Il est remplacé par **DEUX** cas qui, ensemble, décident : l'un prouve que
     * l'optionalité EXISTE (contre-épreuve **positive**, la seule qui rougirait si on
     * remettait l'obligation), l'autre que la règle « pas d'événement ⇒ un lieu » MORD.
     */
    {
      quoi: "sans événement MAIS avec un lieu (l'optionalité de la 9.5)",
      valeur: { ...BASE_VALIDE, eventId: "", venueName: "En ligne" },
      doitPasser: true,
    },
    {
      quoi: "sans événement ET sans lieu (jumeau Zod de `tournament_a_un_lieu`)",
      valeur: { ...BASE_VALIDE, eventId: "" },
      doitPasser: false,
    },
    {
      // ⚠️ Et le rattachement reste possible SANS lieu propre : c'est le cas nominal de la
      // Game'in Reims, où le lieu vient de l'événement. Sans ce troisième cas, une règle
      // « TOUJOURS un lieu » passerait les deux précédents.
      quoi: "AVEC événement et sans lieu (le lieu vient de l'événement)",
      valeur: BASE_VALIDE,
      doitPasser: true,
    },
    {
      // 🔴 LE PIÈGE `date-tz.md`, ÉPROUVÉ : la forme exacte que rend un `datetime-local`.
      quoi: "date SANS FUSEAU (forme d'un <input datetime-local>)",
      valeur: { ...BASE_VALIDE, startsAt: "2026-11-21T14:00" },
      doitPasser: false,
    },
    {
      quoi: "date ISO AVEC fuseau",
      valeur: { ...BASE_VALIDE, startsAt: "2026-11-21T14:00:00+01:00" },
      doitPasser: true,
    },
    {
      // 🔴 LA RÈGLE QUI LIE DEUX CHAMPS (AC3), côté Zod.
      quoi: "mode mately SANS url d'inscription",
      valeur: { ...BASE_VALIDE, registrationMode: "mately" },
      doitPasser: false,
    },
    {
      quoi: "mode mately AVEC url d'inscription",
      valeur: {
        ...BASE_VALIDE,
        registrationMode: "mately",
        registrationUrl: "https://mately.fr/t/42",
      },
      doitPasser: true,
    },
    {
      quoi: "mode interne SANS url (l'url n'y est pas exigée)",
      valeur: { ...BASE_VALIDE, registrationMode: "interne" },
      doitPasser: true,
    },
    {
      // Les trois formes qui passaient `z.url()` puis étaient classées INTERNES par le rendu
      // (défaut trouvé à la revue de la 6.5). Ici l'enjeu est le bouton « S'inscrire ».
      quoi: "url d'inscription en « HTTPS:// » (casse)",
      valeur: { ...BASE_VALIDE, registrationUrl: "HTTPS://mately.fr" },
      doitPasser: false,
    },
    {
      quoi: "url d'inscription à un seul slash",
      valeur: { ...BASE_VALIDE, registrationUrl: "https:/mately.fr" },
      doitPasser: false,
    },
    {
      quoi: "url d'inscription relative",
      valeur: { ...BASE_VALIDE, registrationUrl: "mately.fr" },
      doitPasser: false,
    },
    {
      quoi: "mode d'inscription inconnu",
      valeur: { ...BASE_VALIDE, registrationMode: "helloasso" },
      doitPasser: false,
    },
    {
      quoi: "état d'inscription inconnu",
      valeur: { ...BASE_VALIDE, registrationState: "en-attente" },
      doitPasser: false,
    },
    {
      quoi: "durée de match hors plage int4",
      valeur: { ...BASE_VALIDE, matchDurationMinutes: 5_000_000_000 },
      doitPasser: false,
    },
    {
      quoi: `durée de match à ${DUREE_MATCH_MAX + 1}`,
      valeur: { ...BASE_VALIDE, matchDurationMinutes: DUREE_MATCH_MAX + 1 },
      doitPasser: false,
    },
    {
      quoi: "nombre de places à 0",
      valeur: { ...BASE_VALIDE, capacity: 0 },
      doitPasser: false,
    },
    {
      quoi: `nombre de places à ${PLACES_MAX}`,
      valeur: { ...BASE_VALIDE, capacity: PLACES_MAX },
      doitPasser: true,
    },
    {
      // 🔴 LE PODIUM À TROU, côté Zod (le `CHECK` le tient aussi — voir ⑥).
      quoi: "podium avec 2ᵉ place mais SANS 1ʳᵉ",
      valeur: { ...BASE_VALIDE, podiumSecond: "Quelqu'un" },
      doitPasser: false,
    },
    {
      quoi: "podium avec 3ᵉ place mais SANS 2ᵉ",
      valeur: { ...BASE_VALIDE, podiumFirst: "A", podiumThird: "C" },
      doitPasser: false,
    },
    {
      quoi: "podium complet dans l'ordre",
      valeur: { ...BASE_VALIDE, podiumFirst: "A", podiumSecond: "B", podiumThird: "C" },
      doitPasser: true,
    },
    {
      quoi: "champs facultatifs VIDES → null",
      valeur: { ...BASE_VALIDE, venueName: "", prizes: "  ", formatText: "" },
      doitPasser: true,
    },
    {
      // 🔴 TROUVÉ EN REVUE : un classement ne désigne pas deux fois le même vainqueur.
      quoi: "podium avec la MÊME équipe en 1ʳᵉ et 2ᵉ place",
      valeur: { ...BASE_VALIDE, podiumFirst: "Team Alpha", podiumSecond: "Team Alpha" },
      doitPasser: false,
    },
    {
      quoi: "podium avec la MÊME équipe en 1ʳᵉ et 3ᵉ place",
      valeur: { ...BASE_VALIDE, podiumFirst: "A", podiumSecond: "B", podiumThird: "A" },
      doitPasser: false,
    },
    {
      // La contre-épreuve : deux noms qui ne diffèrent QUE par la casse restent acceptés,
      // et c'est assumé (« ALPHA » et « Alpha » peuvent être deux équipes distinctes).
      quoi: "podium dont deux places ne diffèrent que par la CASSE",
      valeur: { ...BASE_VALIDE, podiumFirst: "Alpha", podiumSecond: "ALPHA" },
      doitPasser: true,
    },
    {
      // 🔴 A2 — LE VISUEL VIENT DE LA GALERIE, et il est FACULTATIF.
      quoi: "visuel absent (chaîne vide → null)",
      valeur: { ...BASE_VALIDE, photoId: "" },
      doitPasser: true,
    },
    {
      quoi: "visuel qui n'est pas un identifiant",
      valeur: { ...BASE_VALIDE, photoId: "pas-un-uuid" },
      doitPasser: false,
    },
  ];

  for (const c of cas) {
    const analyse = tournamentInputSchema.safeParse(c.valeur);
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
  /**
   * 🔴 UN MESSAGE DE BIBLIOTHÈQUE N'EST PAS UN MESSAGE — TROUVÉ EN REVUE, ET MESURÉ.
   * `entierOptionnel` rend `NaN` sur une saisie non numérique. Sans `error` posé sur le type
   * de base, zod échoue AVANT `.int()`/`.min()`/`.max()` et rend son message natif —
   * `« Invalid input: expected number, received NaN »`, **en anglais**, remonté tel quel au
   * bénévole. C'est le symétrique exact de ce que `_commun.ts` fait pour la base.
   * ⚠️ La garde teste l'ABSENCE d'anglais **et** la présence du mot du domaine : chercher
   * seulement « chiffres » laisserait passer un message anglais qui le contiendrait par hasard.
   */
  for (const [champ, attendu] of [
    ["matchDurationMinutes", "minutes"],
    ["capacity", "places"],
  ] as [string, string][]) {
    const r = tournamentInputSchema.safeParse({ ...BASE_VALIDE, [champ]: Number.NaN });
    const message = r.success ? "" : (r.error.issues[0]?.message ?? "");
    const enFrancais = !/Invalid input|expected|received/i.test(message) && message.includes(attendu);
    if (AUTOTEST ? !enFrancais : enFrancais) {
      ok("③ contrat Zod", `${champ} non numérique`, `message en français : « ${message} »`);
    } else {
      ko("③ contrat Zod", `${champ} non numérique`, `message de bibliothèque : « ${message} »`);
    }
  }

  const vide = tournamentInputSchema.safeParse({ ...BASE_VALIDE, venueName: "" });
  if (vide.success && vide.data.venueName === null) {
    ok("③ contrat Zod", "champ facultatif vide", "transformé en null (et non en chaîne vide)");
  } else {
    ko("③ contrat Zod", "champ facultatif vide", "n'est pas transformé en null");
  }
}

// ── ④  LES DEUX ENUMS : BASE ↔ CODE ↔ LIBELLÉS ────────────────────────────────────────
//
// ⚠️ Le typecheck impose déjà l'exhaustivité des libellés (`Record<…, string>`). Cette garde
// existe pour le cas que le typecheck NE voit pas : une valeur ajoutée à l'enum **en base**
// par une migration, sans passer par le tableau TypeScript. Elle rendrait un libellé vide.
{
  const ENUMS = [
    {
      nom: "tournament_registration_mode",
      enCode: [...REGISTRATION_MODES] as string[],
      libelles: LIBELLES_MODE_INSCRIPTION as Record<string, string>,
    },
    {
      nom: "tournament_registration_state",
      enCode: [...REGISTRATION_STATES] as string[],
      libelles: LIBELLES_ETAT_INSCRIPTION as Record<string, string>,
    },
  ];

  for (const { nom, enCode, libelles } of ENUMS) {
    const lignes = await sql<{ valeur: string }[]>`
      select enumlabel as valeur from pg_enum
      where enumtypid = ${nom}::regtype
      order by enumsortorder`;
    const enBase = lignes.map((l) => l.valeur);
    // En autotest, on compare à une liste volontairement fausse : la garde doit le voir.
    const attendu = AUTOTEST ? [...enCode].reverse() : enCode;

    if (JSON.stringify(enBase) === JSON.stringify(attendu)) {
      ok("④ enum ↔ code", nom, `mêmes valeurs ET même ORDRE : ${enBase.join(", ")}`);
    } else {
      ko("④ enum ↔ code", nom, `base [${enBase.join(", ")}] ≠ code [${attendu.join(", ")}]`);
    }

    const sansLibelle = enBase.filter((v) => !(v in libelles));
    if (sansLibelle.length === 0) {
      ok("④ enum ↔ code", `${nom} — libellés`, "chaque valeur de la base a son libellé");
    } else {
      ko("④ enum ↔ code", `${nom} — libellés`, `sans libellé : ${sansLibelle.join(", ")}`);
    }
  }
}

// ── ⑤  LA CONTRAINTE DU MODE EST NULL-SAFE — ET ÇA NE SE MESURE PAS PAR UNE ÉCRITURE ──
//
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA GARDE LA PLUS IMPORTANTE DE CETTE PORTE, ET LA SEULE QUI PUISSE VOIR CE DÉFAUT
// ══════════════════════════════════════════════════════════════════════════════════════
//
// `event_has_venue` (Story 3.1) s'évaluait à `FALSE OR NULL` = **`NULL`** dans le cas EXACT
// qu'elle interdisait, et **un `CHECK` qui vaut `NULL` PASSE**. Trois epics, sept portes
// vertes, personne ne l'a vu.
//
// 🔬 `gate:ateliers` ⑧ a ÉTABLI PAR L'EXPÉRIENCE qu'on ne peut PAS mesurer la null-safety par
// une écriture : la branche `is null` retirée en base, **seule** la garde qui LIT le texte de
// la contrainte est passée au rouge — la contre-épreuve « colonne à NULL » est restée VERTE,
// parce que le défaut la rend aveugle **par construction**.
// ⇒ Cette garde lit `pg_get_constraintdef`, et elle vérifie **DEUX verrous indépendants** :
//   ① la branche `is null` est bien présente dans le texte de la contrainte ;
//   ② la colonne `registration_mode` est bien `NOT NULL` en base.
// Le second n'est pas décoratif : c'est lui qui rend la branche ① inatteignable aujourd'hui,
// et c'est sa disparition qui la rendrait nécessaire. Perdre l'un des deux sans l'autre est
// exactement la dégradation silencieuse qu'on refuse.
{
  const [contrainte] = await sql<{ definition: string }[]>`
    select pg_get_constraintdef(oid) as definition from pg_constraint
    where conrelid = 'tournament'::regclass and conname = 'tournament_mately_a_son_url'`;

  if (!contrainte) {
    ko("⑤ null-safety", "tournament_mately_a_son_url", "la contrainte N'EXISTE PAS en base");
  } else {
    const definition = contrainte.definition;
    // En autotest, on exige une formule qui n'y est pas : la garde doit le voir.
    const motif = AUTOTEST ? /IS NOT DISTINCT FROM/i : /IS NULL/i;
    if (motif.test(definition)) {
      ok(
        "⑤ null-safety",
        "tournament_mately_a_son_url",
        `branche \`is null\` présente : ${definition}`,
      );
    } else {
      ko(
        "⑤ null-safety",
        "tournament_mately_a_son_url",
        `AUCUNE branche \`is null\` — le CHECK vaudrait NULL, donc PASSERAIT : ${definition}`,
      );
    }
  }

  const [colonne] = await sql<{ nullable: string }[]>`
    select is_nullable as nullable from information_schema.columns
    where table_schema = 'public' and table_name = 'tournament'
      and column_name = ${AUTOTEST ? "venue_name" : "registration_mode"}`;

  if (colonne?.nullable === "NO") {
    ok("⑤ null-safety", "registration_mode", "colonne NOT NULL — 2ᵉ verrou en place");
  } else {
    ko(
      "⑤ null-safety",
      "registration_mode",
      `colonne NULLABLE (${colonne?.nullable ?? "introuvable"}) — le 2ᵉ verrou a sauté`,
    );
  }
}

// ── ⑥  LA BASE REFUSE CE QUE ZOD REFUSE — écritures SQL directes, hors de tout schéma ──
//
// 🔴 CHAQUE LIGNE CI-DESSOUS DOIT ÉCHOUER. Un `UPDATE` direct, une restauration de sauvegarde
// ou une migration de données ne passent par AUCUN schéma Zod : la base est le garde-fou qu'on
// ne peut pas contourner.
// ⚠️ Chaque cas reçoit `tx` en paramètre — leçon de `gate:partenaires`, où des fabriques
// `() => sql\`…\`` exécutées dans `sql.begin` demandaient une SECONDE connexion à un pool
// `max: 1` : interblocage, et une porte qui ne rendait AUCUN verdict.
// ⚠️ Chaque cas crée SON PROPRE événement de rattachement DANS la transaction : `event_id` est
// `NOT NULL` (A4), donc aucune ligne de tournoi n'est écrivable sans lui. La transaction étant
// annulée, cet événement n'existe jamais du point de vue de qui que ce soit d'autre.
type EcritureRefusee = {
  quoi: string;
  contrainte: string;
  colonnes: string;
  valeurs: string;
};

/** Crée un événement témoin DANS la transaction et rend son identifiant. */
async function evenementTemoin(tx: postgres.TransactionSql): Promise<string> {
  const [ligne] = await tx<{ id: string }[]>`
    insert into event (title, venue_name, starts_at)
    values (${MARQUE + "-evt"}, 'Salle temoin', now())
    returning id`;
  return ligne.id;
}

const ECRITURES_REFUSEES: EcritureRefusee[] = [
  {
    quoi: "name vide",
    contrainte: "tournament_name_valide",
    colonnes: "name, game, slug, starts_at, registration_mode",
    valeurs: `'', 'CS2', 'a-b', now(), 'interne'`,
  },
  {
    quoi: "name de blancs ASCII",
    contrainte: "tournament_name_valide",
    colonnes: "name, game, slug, starts_at, registration_mode",
    valeurs: `'   ', 'CS2', 'a-b', now(), 'interne'`,
  },
  {
    quoi: `name à ${NOM_MAX + 1}`,
    contrainte: "tournament_name_valide",
    colonnes: "name, game, slug, starts_at, registration_mode",
    valeurs: `'${"a".repeat(NOM_MAX + 1)}', 'CS2', 'a-b', now(), 'interne'`,
  },
  {
    quoi: "game vide",
    contrainte: "tournament_game_valide",
    colonnes: "name, game, slug, starts_at, registration_mode",
    valeurs: `'T', '', 'a-b', now(), 'interne'`,
  },
  {
    quoi: `game à ${JEU_MAX + 1}`,
    contrainte: "tournament_game_valide",
    colonnes: "name, game, slug, starts_at, registration_mode",
    valeurs: `'T', '${"a".repeat(JEU_MAX + 1)}', 'a-b', now(), 'interne'`,
  },
  {
    quoi: "slug avec une MAJUSCULE",
    contrainte: "tournament_slug_valide",
    colonnes: "name, game, slug, starts_at, registration_mode",
    valeurs: `'T', 'CS2', 'Tournoi', now(), 'interne'`,
  },
  {
    quoi: "slug avec un SLASH",
    contrainte: "tournament_slug_valide",
    colonnes: "name, game, slug, starts_at, registration_mode",
    valeurs: `'T', 'CS2', 'a/b', now(), 'interne'`,
  },
  {
    quoi: "slug avec un POINT",
    contrainte: "tournament_slug_valide",
    colonnes: "name, game, slug, starts_at, registration_mode",
    valeurs: `'T', 'CS2', 'a.b', now(), 'interne'`,
  },
  {
    quoi: "slug vide",
    contrainte: "tournament_slug_valide",
    colonnes: "name, game, slug, starts_at, registration_mode",
    valeurs: `'T', 'CS2', '', now(), 'interne'`,
  },
  {
    quoi: `slug à ${IDENTIFIANT_MAX + 1}`,
    contrainte: "tournament_slug_valide",
    colonnes: "name, game, slug, starts_at, registration_mode",
    valeurs: `'T', 'CS2', '${"a".repeat(IDENTIFIANT_MAX + 1)}', now(), 'interne'`,
  },
  {
    // 🔴 LA RÈGLE DE L'AC3, ÉPROUVÉE CÔTÉ BASE ET PAS SEULEMENT CÔTÉ ZOD.
    quoi: "mode mately SANS url d'inscription",
    contrainte: "tournament_mately_a_son_url",
    colonnes: "name, game, slug, starts_at, registration_mode",
    valeurs: `'T', 'CS2', 'a-b', now(), 'mately'`,
  },
  {
    quoi: "url d'inscription qui n'est pas en http(s)",
    contrainte: "tournament_registration_url_valide",
    colonnes: "name, game, slug, starts_at, registration_mode, registration_url",
    valeurs: `'T', 'CS2', 'a-b', now(), 'interne', 'javascript:alert(1)'`,
  },
  {
    quoi: `url d'inscription à ${URL_MAX + 1}`,
    contrainte: "tournament_registration_url_valide",
    colonnes: "name, game, slug, starts_at, registration_mode, registration_url",
    valeurs: `'T', 'CS2', 'a-b', now(), 'interne', 'https://x.fr/${"a".repeat(URL_MAX)}'`,
  },
  {
    quoi: "venue_name NON NULL mais vide",
    contrainte: "tournament_venue_name_valide",
    colonnes: "name, game, slug, starts_at, registration_mode, venue_name",
    valeurs: `'T', 'CS2', 'a-b', now(), 'interne', '  '`,
  },
  {
    quoi: `format_text à ${FORMAT_MAX + 1}`,
    contrainte: "tournament_format_text_valide",
    colonnes: "name, game, slug, starts_at, registration_mode, format_text",
    valeurs: `'T', 'CS2', 'a-b', now(), 'interne', '${"a".repeat(FORMAT_MAX + 1)}'`,
  },
  {
    quoi: `prizes à ${LOTS_MAX + 1}`,
    contrainte: "tournament_prizes_valide",
    colonnes: "name, game, slug, starts_at, registration_mode, prizes",
    valeurs: `'T', 'CS2', 'a-b', now(), 'interne', '${"a".repeat(LOTS_MAX + 1)}'`,
  },
  {
    quoi: "durée de match à 0",
    contrainte: "tournament_match_duration_valide",
    colonnes: "name, game, slug, starts_at, registration_mode, match_duration_minutes",
    valeurs: `'T', 'CS2', 'a-b', now(), 'interne', 0`,
  },
  {
    quoi: `durée de match à ${DUREE_MATCH_MAX + 1}`,
    contrainte: "tournament_match_duration_valide",
    colonnes: "name, game, slug, starts_at, registration_mode, match_duration_minutes",
    valeurs: `'T', 'CS2', 'a-b', now(), 'interne', ${DUREE_MATCH_MAX + 1}`,
  },
  {
    quoi: "nombre de places à 0",
    contrainte: "tournament_capacity_valide",
    colonnes: "name, game, slug, starts_at, registration_mode, capacity",
    valeurs: `'T', 'CS2', 'a-b', now(), 'interne', 0`,
  },
  {
    quoi: `nombre de places à ${PLACES_MAX + 1}`,
    contrainte: "tournament_capacity_valide",
    colonnes: "name, game, slug, starts_at, registration_mode, capacity",
    valeurs: `'T', 'CS2', 'a-b', now(), 'interne', ${PLACES_MAX + 1}`,
  },
  {
    quoi: `podium_first à ${PODIUM_MAX + 1}`,
    contrainte: "tournament_podium_first_valide",
    colonnes: "name, game, slug, starts_at, registration_mode, podium_first",
    valeurs: `'T', 'CS2', 'a-b', now(), 'interne', '${"a".repeat(PODIUM_MAX + 1)}'`,
  },
  {
    quoi: "podium à trou : 2ᵉ place sans 1ʳᵉ",
    contrainte: "tournament_podium_sans_trou_2",
    colonnes: "name, game, slug, starts_at, registration_mode, podium_second",
    valeurs: `'T', 'CS2', 'a-b', now(), 'interne', 'Deuxieme'`,
  },
  {
    quoi: "podium à trou : 3ᵉ place sans 2ᵉ",
    contrainte: "tournament_podium_sans_trou_3",
    colonnes: "name, game, slug, starts_at, registration_mode, podium_first, podium_third",
    valeurs: `'T', 'CS2', 'a-b', now(), 'interne', 'Premier', 'Troisieme'`,
  },
  {
    quoi: "podium en DOUBLON : même équipe en 1ʳᵉ et 2ᵉ",
    contrainte: "tournament_podium_2_distinct",
    colonnes: "name, game, slug, starts_at, registration_mode, podium_first, podium_second",
    valeurs: `'T', 'CS2', 'a-b', now(), 'interne', 'Team Alpha', 'Team Alpha'`,
  },
  {
    quoi: "podium en DOUBLON : même équipe en 1ʳᵉ et 3ᵉ",
    contrainte: "tournament_podium_3_distinct",
    colonnes:
      "name, game, slug, starts_at, registration_mode, podium_first, podium_second, podium_third",
    valeurs: `'T', 'CS2', 'a-b', now(), 'interne', 'A', 'B', 'A'`,
  },
  {
    quoi: "visuel pointant une photo INEXISTANTE",
    contrainte: "23503",
    colonnes: "name, game, slug, starts_at, registration_mode, photo_id",
    valeurs: `'T', 'CS2', 'a-b', now(), 'interne', '00000000-0000-4000-8000-000000000000'`,
  },
  {
    quoi: "registration_mode absent de l'enum",
    contrainte: "22P02",
    colonnes: "name, game, slug, starts_at, registration_mode",
    valeurs: `'T', 'CS2', 'a-b', now(), 'helloasso'`,
  },
  {
    quoi: "registration_mode NULL",
    contrainte: "23502",
    colonnes: "name, game, slug, starts_at",
    valeurs: `'T', 'CS2', 'a-b', now()`,
  },
  {
    quoi: "name NULL",
    contrainte: "23502",
    colonnes: "game, slug, starts_at, registration_mode",
    valeurs: `'CS2', 'a-b', now(), 'interne'`,
  },
];

// En autotest, on remplace les écritures par une qui DOIT réussir : si la garde reste verte
// alors qu'on lui présente un succès, elle ne mesure rien.
const ECRITURES_EPROUVEES: EcritureRefusee[] = AUTOTEST
  ? [
      {
        quoi: "AUTOTEST — écriture parfaitement valide",
        contrainte: "aucune",
        colonnes: "name, game, slug, starts_at, registration_mode",
        valeurs: `'Autotest', 'CS2', 'autotest-valide', now(), 'interne'`,
      },
    ]
  : ECRITURES_REFUSEES;

for (const cas of ECRITURES_EPROUVEES) {
  try {
    await sql.begin(async (tx) => {
      const idEvenement = await evenementTemoin(tx);
      await tx.unsafe(
        `insert into tournament (event_id, ${cas.colonnes}) values ('${idEvenement}', ${cas.valeurs})`,
      );
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
  const CONTRE_EPREUVES: { quoi: string; colonnes: string; valeurs: string }[] = [
    {
      quoi: "minimal (les cinq colonnes obligatoires)",
      colonnes: "name, game, slug, starts_at, registration_mode",
      valeurs: `'Contre-epreuve', 'CS2', 'contre-epreuve', now(), 'interne'`,
    },
    {
      quoi: `name PILE à ${NOM_MAX}`,
      colonnes: "name, game, slug, starts_at, registration_mode",
      valeurs: `'${"a".repeat(NOM_MAX)}', 'CS2', 'a-b', now(), 'interne'`,
    },
    {
      quoi: `slug PILE à ${IDENTIFIANT_MAX}`,
      colonnes: "name, game, slug, starts_at, registration_mode",
      valeurs: `'T', 'CS2', '${"a".repeat(IDENTIFIANT_MAX)}', now(), 'interne'`,
    },
    {
      quoi: "slug d'un seul caractère (le motif l'autorise)",
      colonnes: "name, game, slug, starts_at, registration_mode",
      valeurs: `'T', 'CS2', 'a', now(), 'interne'`,
    },
    {
      quoi: "slug à chiffres et tirets (« cs2-2v2-gir-2026 »)",
      colonnes: "name, game, slug, starts_at, registration_mode",
      valeurs: `'T', 'CS2', 'cs2-2v2-gir-2026', now(), 'interne'`,
    },
    {
      quoi: "mode mately AVEC url d'inscription",
      colonnes: "name, game, slug, starts_at, registration_mode, registration_url",
      valeurs: `'T', 'CS2', 'a-b', now(), 'mately', 'https://mately.fr/t/42'`,
    },
    {
      // 🔴 LA BRANCHE `is null` DES CONTRAINTES NULLABLES, ÉPROUVÉE EXPLICITEMENT.
      // C'est le cas exact où `event_has_venue` s'évaluait à NULL et passait sans rien garder :
      // ici, `NULL` DOIT passer, et c'est voulu — mais il faut l'avoir VU passer.
      // ⚠️ Cette contre-épreuve NE PROUVE PAS la null-safety (leçon `gate:ateliers` ⑧) — c'est
      // la garde ⑤ qui le fait, en LISANT le texte de la contrainte. Les deux sont nécessaires.
      quoi: "les huit colonnes facultatives explicitement NULL",
      colonnes:
        "name, game, slug, starts_at, registration_mode, venue_name, format_text, prizes, " +
        "match_duration_minutes, capacity, registration_url, podium_first, podium_second, podium_third",
      valeurs: `'T', 'CS2', 'a-b', now(), 'interne', null, null, null, null, null, null, null, null, null`,
    },
    {
      quoi: `durée de match PILE à ${DUREE_MATCH_MAX}`,
      colonnes: "name, game, slug, starts_at, registration_mode, match_duration_minutes",
      valeurs: `'T', 'CS2', 'a-b', now(), 'interne', ${DUREE_MATCH_MAX}`,
    },
    {
      quoi: `nombre de places PILE à ${PLACES_MAX}`,
      colonnes: "name, game, slug, starts_at, registration_mode, capacity",
      valeurs: `'T', 'CS2', 'a-b', now(), 'interne', ${PLACES_MAX}`,
    },
    {
      quoi: "podium complet dans l'ordre",
      colonnes:
        "name, game, slug, starts_at, registration_mode, podium_first, podium_second, podium_third",
      valeurs: `'T', 'CS2', 'a-b', now(), 'interne', 'A', 'B', 'C'`,
    },
    {
      quoi: "podium dont deux places ne diffèrent que par la CASSE (assumé acceptable)",
      colonnes:
        "name, game, slug, starts_at, registration_mode, podium_first, podium_second",
      valeurs: `'T', 'CS2', 'a-b', now(), 'interne', 'Alpha', 'ALPHA'`,
    },
    {
      quoi: "visuel explicitement NULL (A2 : le visuel est FACULTATIF)",
      colonnes: "name, game, slug, starts_at, registration_mode, photo_id",
      valeurs: `'T', 'CS2', 'a-b', now(), 'interne', null`,
    },
    {
      quoi: "podium partiel : 1ʳᵉ place seule",
      colonnes: "name, game, slug, starts_at, registration_mode, podium_first",
      valeurs: `'T', 'CS2', 'a-b', now(), 'interne', 'A'`,
    },
    {
      // 🔴 UN TOURNOI PASSÉ AVEC PODIUM **ET** UN TOURNOI FUTUR AVEC PODIUM : les DEUX doivent
      // passer. C'est la contre-épreuve de l'AC4 — aucun `CHECK` « podium seulement si passé »
      // n'est tenté, et il ne faut pas qu'on en ajoute un un jour sans s'en rendre compte.
      // ⚠️ Un tel `CHECK` serait d'ailleurs refusé par Postgres (non immuable), mais rien
      // n'empêcherait un trigger : cette garde le verrait.
      quoi: "podium sur un tournoi FUTUR (aucun CHECK de date n'est tenté — AC4)",
      colonnes: "name, game, slug, starts_at, registration_mode, podium_first",
      valeurs: `'T', 'CS2', 'a-b', now() + interval '1 year', 'interne', 'A'`,
    },
  ];

  for (const cas of CONTRE_EPREUVES) {
    try {
      await sql.begin(async (tx) => {
        const idEvenement = await evenementTemoin(tx);
        await tx.unsafe(
          `insert into tournament (event_id, ${cas.colonnes}) values ('${idEvenement}', ${cas.valeurs})`,
        );
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
  const bornes: { contrainte: string; borne: number; nullable: boolean }[] = [
    { contrainte: "tournament_name_valide", borne: NOM_MAX, nullable: false },
    { contrainte: "tournament_game_valide", borne: JEU_MAX, nullable: false },
    { contrainte: "tournament_slug_valide", borne: IDENTIFIANT_MAX, nullable: false },
    { contrainte: "tournament_venue_name_valide", borne: LIEU_MAX, nullable: true },
    { contrainte: "tournament_format_text_valide", borne: FORMAT_MAX, nullable: true },
    { contrainte: "tournament_prizes_valide", borne: LOTS_MAX, nullable: true },
    { contrainte: "tournament_match_duration_valide", borne: DUREE_MATCH_MAX, nullable: true },
    { contrainte: "tournament_capacity_valide", borne: PLACES_MAX, nullable: true },
    { contrainte: "tournament_registration_url_valide", borne: URL_MAX, nullable: true },
    { contrainte: "tournament_podium_first_valide", borne: PODIUM_MAX, nullable: true },
    { contrainte: "tournament_podium_second_valide", borne: PODIUM_MAX, nullable: true },
    { contrainte: "tournament_podium_third_valide", borne: PODIUM_MAX, nullable: true },
  ];

  for (const { contrainte, borne, nullable } of bornes) {
    const lignes = await sql<{ definition: string }[]>`
      select pg_get_constraintdef(oid) as definition from pg_constraint
      where conrelid = 'tournament'::regclass and conname = ${contrainte}`;

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

    // 🔴 ET LA CONTRAINTE DOIT ÊTRE NULL-SAFE quand la colonne est nullable — même garde que
    // ⑤, appliquée aux onze autres contraintes. Voir le bloc ⑤ pour pourquoi la lecture du
    // texte est le SEUL témoin possible.
    if (nullable) {
      if (/IS NULL/i.test(definition)) {
        ok("⑧ parité base/Zod", contrainte, "null-safe (branche `is null` explicite)");
      } else {
        ko(
          "⑧ parité base/Zod",
          contrainte,
          "colonne NULLABLE sans branche `is null` — le CHECK vaudra NULL, donc PASSERA",
        );
      }
    }
  }
}

// ── ⑨  LE MOTIF D'ADRESSE : JS ET SQL DISENT LA MÊME CHOSE ────────────────────────────
//
// 🔴 DEUX ÉCRITURES DE LA MÊME RÈGLE, CONFRONTÉES AUX **MÊMES VALEURS** — patron
// `MOTIF_EMAIL` / `MOTIF_EMAIL_SQL` de `gate:reglages` ①. Ce ne sont pas deux copies (l'une
// est en JS, l'autre en ERE POSIX, et POSIX n'a pas de groupe non capturant), mais rien
// n'empêche qu'elles divergent — et une divergence ici veut dire : une adresse acceptée par le
// formulaire et refusée par la base, ou l'inverse.
// ⚠️ On interroge Postgres pour le motif SQL, jamais une réimplémentation JS de POSIX.
{
  const CAS_MOTIF = [
    { valeur: "cs2-2v2-gir-2026", attendu: true },
    { valeur: "a", attendu: true },
    { valeur: "tft", attendu: true },
    { valeur: "2026", attendu: true },
    { valeur: "", attendu: false },
    { valeur: "Tournoi", attendu: false },
    { valeur: "tournoi validé", attendu: false },
    { valeur: "tournoi_valide", attendu: false },
    { valeur: "tournoi.valide", attendu: false },
    { valeur: "tournoi/valide", attendu: false },
    { valeur: "-tournoi", attendu: false },
    { valeur: "tournoi-", attendu: false },
    { valeur: "tournoi--valide", attendu: false },
    { valeur: "tournoi valide", attendu: false },
  ];

  for (const cas of CAS_MOTIF) {
    const enJs = MOTIF_IDENTIFIANT.test(cas.valeur);
    const [{ ok: enSql }] = await sql<{ ok: boolean }[]>`
      select (${cas.valeur} ~ '^[a-z0-9]+(-[a-z0-9]+)*$') as ok`;
    // En autotest, on exige l'inverse du verdict JS : la garde doit voir la divergence.
    const attenduJs = AUTOTEST ? !cas.attendu : cas.attendu;

    if (enJs === attenduJs && enSql === cas.attendu && enJs === enSql) {
      ok("⑨ motif JS ↔ SQL", `« ${cas.valeur} »`, cas.attendu ? "accepté des deux côtés" : "refusé des deux côtés");
    } else {
      ko(
        "⑨ motif JS ↔ SQL",
        `« ${cas.valeur} »`,
        `attendu ${cas.attendu}, JS dit ${enJs}, SQL dit ${enSql}`,
      );
    }
  }

  // La dérivation d'un nom vers un identifiant doit produire une valeur que le motif accepte,
  // sinon le formulaire pré-remplirait un champ invalide dès la frappe du nom.
  const DERIVATIONS = [
    { nom: "CS2 2v2 — Game'in Reims 2026", attendu: "cs2-2v2-game-in-reims-2026" },
    { nom: "Tournoi Téléfoot !!", attendu: "tournoi-telefoot" },
    { nom: "  espaces  ", attendu: "espaces" },
    { nom: "TFT 🎮", attendu: "tft" },
    // 🔴 LE CAS QUI REND `""` — il est RÉEL, pas théorique, et l'appelant ne doit jamais
    // supposer un résultat non vide (voir `fabriquerIdentifiant`).
    { nom: "日本語", attendu: "" },
  ];
  for (const d of DERIVATIONS) {
    const obtenu = fabriquerIdentifiant(d.nom);
    const attendu = AUTOTEST ? d.attendu + "-faux" : d.attendu;
    if (obtenu === attendu) {
      ok("⑨ motif JS ↔ SQL", `dérivation « ${d.nom} »`, `→ « ${obtenu} »`);
    } else {
      ko("⑨ motif JS ↔ SQL", `dérivation « ${d.nom} »`, `attendu « ${attendu} », obtenu « ${obtenu} »`);
    }
    if (obtenu !== "" && !MOTIF_IDENTIFIANT.test(obtenu)) {
      ko("⑨ motif JS ↔ SQL", `dérivation « ${d.nom} »`, `produit « ${obtenu} », que le motif REFUSE`);
    }
  }
}

// ── ⑩  L'UNICITÉ DE L'ADRESSE — MESURÉE PAR UNE VRAIE DOUBLE ÉCRITURE ─────────────────
//
// 🔴 C'EST L'ADRESSE PUBLIQUE D'UN TOURNOI (A20 : *« les URLs sont stables dès le premier
// jour »*, et c'est vers elles que pointeront MATELY, les réseaux et les flyers). Deux
// tournois au même identifiant rendraient la fiche `/tournois/<slug>` **non déterministe** :
// un `findFirst` en choisirait un arbitrairement, et l'autre serait injoignable — en silence.
// ⚠️ Le contrôle applicatif (`slugDejaPris`) n'est PAS le garde-fou, c'est le message : il est
// sujet à une course. Le garde-fou est cette contrainte, et c'est elle qu'on éprouve.
{
  try {
    await sql.begin(async (tx) => {
      const idEvenement = await evenementTemoin(tx);
      const slug = AUTOTEST ? "unicite-a" : "unicite-temoin";
      await tx`insert into tournament (event_id, name, game, slug, starts_at, registration_mode)
               values (${idEvenement}, 'Premier', 'CS2', ${slug}, now(), 'interne')`;
      // En autotest, on écrit un slug DIFFÉRENT : la seconde écriture doit alors réussir, et
      // la garde doit s'en apercevoir.
      await tx`insert into tournament (event_id, name, game, slug, starts_at, registration_mode)
               values (${idEvenement}, 'Second', 'CS2', ${AUTOTEST ? "unicite-b" : slug}, now(), 'interne')`;
      throw new Error("__ACCEPTE__");
    });
    ko("⑩ unicité d'adresse", "deux tournois, même slug", "ACCEPTÉS — la fiche serait non déterministe");
  } catch (erreur) {
    const details = erreur as { message?: string; code?: string; constraint_name?: string };
    if (details.message === "__ACCEPTE__") {
      ko("⑩ unicité d'adresse", "deux tournois, même slug", "ACCEPTÉS — la fiche serait non déterministe");
    } else {
      ok("⑩ unicité d'adresse", "deux tournois, même slug", `refusé par ${details.constraint_name ?? details.code}`);
    }
  }
}

// ── ⑪  L'ORDRE EST TOTAL — mesuré, pas relu ───────────────────────────────────────────
//
// 🔴 LE DÉFAUT QU'AUCUNE AUTRE PORTE NE VERRAIT, ET QUI SERAIT IRREPRODUCTIBLE À LA MAIN.
// `/tournois` sera `force-dynamic` (Story 9.2) : la requête sera rejouée à CHAQUE visite. Si le
// tri ne départage pas tout, deux tournois de même `starts_at` — **le cas nominal de la Game'in
// Reims**, dix animations sur deux jours dont plusieurs en parallèle — sortent dans un ordre
// que Postgres ne garantit pas, et la liste se réordonne d'une visite à l'autre.
{
  try {
    await sql.begin(async (tx) => {
      const idEvenement = await evenementTemoin(tx);
      for (const nom of ["c", "a", "b"]) {
        await tx`insert into tournament (event_id, name, game, slug, starts_at, registration_mode)
                 values (${idEvenement}, ${MARQUE + "-" + nom}, 'CS2', ${"ordre-" + nom}, '2026-11-21T14:00:00+01:00', 'interne')`;
      }

      // Le tri EXACT de `queries/tournaments.ts`. En autotest on l'ampute de ses deux derniers
      // termes : la garde doit alors être capable de voir le problème.
      const suites: string[][] = [];
      for (let essai = 0; essai < 5; essai++) {
        const lignes = AUTOTEST
          ? await tx<{ name: string }[]>`
              select name from tournament where name like ${MARQUE + "%"} order by starts_at`
          : await tx<{ name: string }[]>`
              select name from tournament where name like ${MARQUE + "%"}
              order by starts_at, name, id`;
        suites.push(lignes.map((l) => l.name));
      }

      const premiere = JSON.stringify(suites[0]);
      const stable = suites.every((s) => JSON.stringify(s) === premiere);
      // Un ordre TOTAL sur ces trois lignes est nécessairement l'ordre alphabétique des noms
      // (même date) : c'est ce qui rend la garde décidable plutôt que tautologique.
      const attendu = JSON.stringify([MARQUE + "-a", MARQUE + "-b", MARQUE + "-c"]);

      if (stable && premiere === attendu) {
        ok("⑪ ordre total", "3 tournois à la MÊME date", "départagés par le nom, ordre stable sur 5 lectures");
      } else if (!stable) {
        ko("⑪ ordre total", "3 tournois à la même date", "l'ordre CHANGE d'une lecture à l'autre — la liste se réordonnera toute seule");
      } else {
        ko("⑪ ordre total", "3 tournois à la même date", `ordre non déterministe : ${premiere} ≠ ${attendu}`);
      }
      throw new Error("__ROLLBACK__");
    });
  } catch (erreur) {
    const details = erreur as { message?: string };
    if (details.message !== "__ROLLBACK__") {
      ko("⑪ ordre total", "3 tournois à la même date", `la transaction a échoué : ${String(erreur)}`);
    }
  }
}

// ── ⑫  LE SCHÉMA N'A AUCUNE COLONNE DE PHASE, D'INSCRIPTION NI D'ENGAGÉ ───────────────
//
// 🔴 L'ABSENCE EST LE LIVRABLE (périmètre A5), ET C'EST LA SEULE RÈGLE DE CETTE STORY
// QU'AUCUNE RELECTURE NE TIENDRA DANS SIX MOIS. Quelqu'un ajoutera un jour « juste un champ
// nombre d'inscrits, c'est pratique » — et la racine minimale cesse d'être minimale, sans
// qu'aucune porte ne le dise. Celle-ci le dit.
// ⚠️ On lit le SCHÉMA RÉEL de la base, pas le fichier TypeScript : une migration écrite à la
// main ne passerait pas par `schema.ts`.
// ⚠️ `capacity` N'EST PAS DANS LA LISTE, ET C'EST DÉLIBÉRÉ : le nombre de places annoncé est
// explicitement demandé par A23 ①, et la Story 11.1 doit l'envoyer à MATELY. C'est une
// contrainte d'organisation, pas un « chiffre de communauté » au sens de FR16 — la distinction
// est écrite dans `schemas/tournament.ts` et dans `schema.ts`.
{
  const INTERDITS = [
    "phase",
    "match",
    "round",
    "lobby",
    "bracket",
    "inscri",
    // 🔴 « registration » EN ENTIER, ET NON `registration_count` EN LITTÉRAL — ÉLARGI LE
    // 2026-08-13, ET C'EST LA CONTRE-ÉPREUVE DE L'EXEMPTION QUI L'A TROUVÉ.
    // La liste disait `registration_count`, un nom précis parmi une famille infinie :
    // `registration_total`, `registration_id`, `registrations` seraient tous passés. Une
    // énumération à la main de ce qu'on redoute se désaligne à la première variante — c'est
    // la même erreur que les listes nominatives que ce projet a déjà payées trois fois
    // (`_sections.ts`, `CHAMPS_URL`, la couverture d'autotest de `gate:reseaux`).
    // ⚠️ Les TROIS colonnes légitimes (`registration_mode`, `registration_url`,
    // `registration_state`, A23 ②) sont exemptées NOMMÉMENT ci-dessous, et l'exemption est
    // exacte : elle ne couvre pas la famille.
    "registration",
    "participant",
    "engage",
    "player",
    "joueur",
    "equipe",
    "team",
    "score",
    "seed",
  ];
  const colonnes = await sql<{ nom: string }[]>`
    select column_name as nom from information_schema.columns
    where table_schema = 'public' and table_name = 'tournament'`;
  const noms = colonnes.map((c) => c.nom);

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════
   * 🔴 EXEMPTION — ET ELLE A ÉTÉ PAYÉE PAR UN VERDICT ROUGE SUR UN PRODUIT SAIN
   * ══════════════════════════════════════════════════════════════════════════════════════
   *
   * 🔬 MESURÉ le 2026-08-13, au premier lancement réel de cette porte : la garde a signalé
   * `match_duration_minutes` comme « hors périmètre ». **C'était l'instrument qui avait tort.**
   * Le motif `match` visait l'entité RENCONTRE de l'Epic 10 (`match`, `match_participant`) ;
   * `match_duration_minutes` est la **durée ANNONCÉE d'un match**, exigée nommément par A23 ③
   * et par l'AC2 de la story — une donnée éditoriale, pas une rencontre.
   * ⇒ 18ᵉ instrument faux de ce projet, et il **accusait le produit**, comme les ~17 de
   * l'Epic 6. La règle a été appliquée : prouver l'instrument AVANT de corriger le produit.
   *
   * 🔴 L'ASSOUPLISSEMENT SUIT LA PARADE n°6 DE `pieges/instrument-non-valide.md`, ses TROIS
   * conditions comprises — une exclusion non bornée serait une **porte dérobée** :
   *   ① **CONDITIONNELLE** — l'exemption porte sur un nom de colonne **EXACT**, jamais sur un
   *      préfixe. `match_id`, `matches`, `match_count` restent donc attrapés. Une exemption
   *      par `startsWith("match")` aurait éteint la garde sur toute la famille ;
   *   ② **VISIBLE** — les exemptions retenues sont **comptées et rapportées** à chaque
   *      exécution, pour qu'un abus se remarque ;
   *   ③ **ÉPROUVÉE** — la garde de péremption ci-dessous refuse une exemption qui ne
   *      correspond à AUCUNE colonne réelle. Une exemption qui survit à la suppression de sa
   *      colonne est une porte dérobée qui dort.
   */
  const EXEMPTIONS_COLONNES: Record<string, string> = {
    match_duration_minutes:
      "durée ANNONCÉE d'un match (A23 ③, AC2) — une donnée éditoriale, pas une rencontre",
    registration_mode:
      "mode d'inscription (A23 ②) — une PORTE D'ENTRÉE, pas une inscription enregistrée",
    registration_url: "adresse d'inscription (A23 ②) — un lien sortant, pas une inscription",
    registration_state: "état des inscriptions (A23 ②) — un fait annoncé, pas un inscrit",
  };

  const cherchees = AUTOTEST ? ["name"] : INTERDITS;
  const suspectes = noms.filter((n) => cherchees.some((i) => n.includes(i)));
  const exemptees = suspectes.filter((n) => n in EXEMPTIONS_COLONNES);
  const trouves = suspectes.filter((n) => !(n in EXEMPTIONS_COLONNES));

  if (trouves.length === 0) {
    ok(
      "⑫ périmètre A5",
      "colonnes de tournament",
      `aucune colonne de phase, d'inscrit ni d'engagé (${noms.length} colonnes` +
        `${exemptees.length > 0 ? `, ${exemptees.length} exemptée(s) : ${exemptees.join(", ")}` : ""})`,
    );
  } else {
    ko("⑫ périmètre A5", "colonnes de tournament", `colonne(s) hors périmètre : ${trouves.join(", ")} — la racine minimale ne l'est plus`);
  }

  /**
   * ③ (suite) LE CAS DE NON-RÉGRESSION DE L'EXEMPTION — sans lui, on ne saurait pas si
   * l'assouplissement a rendu la garde aveugle sur toute la famille `match*`.
   *
   * 🔴 IL S'ÉVALUE SUR DES NOMS **FICTIFS**, et c'est le seul moyen : on ne va pas ajouter
   * une vraie colonne `match_id` à la base pour éprouver une garde. Ce qu'on teste ici est
   * donc le **prédicat**, exactement celui qu'utilise la garde trois lignes plus haut — pas
   * une réimplémentation (`pieges/garde-nominale.md`).
   */
  {
    const attrape = (nom: string) =>
      INTERDITS.some((i) => nom.includes(i)) && !(nom in EXEMPTIONS_COLONNES);
    // ⚠️ `registration_total` A TROUVÉ UN VRAI TROU le 2026-08-13 : la liste `INTERDITS`
    // portait `registration_count` en LITTÉRAL, donc toute autre variante passait. La garde a
    // été élargie (voir `INTERDITS`), pas la contre-épreuve affaiblie — c'est le sens de
    // marche : quand le cas de non-régression rougit, c'est lui qui a raison.
    const DOIVENT_ETRE_ATTRAPES = [
      "match_id",
      "matches",
      "match_count",
      "phase_id",
      "registration_total",
      "registration_id",
      "registrations",
    ];
    const DOIT_ETRE_EXEMPTE = "match_duration_minutes";

    const rates = DOIVENT_ETRE_ATTRAPES.filter((n) => !attrape(n));
    const exempteOk = AUTOTEST ? attrape(DOIT_ETRE_EXEMPTE) : !attrape(DOIT_ETRE_EXEMPTE);

    if (rates.length === 0 && exempteOk) {
      ok(
        "⑫ périmètre A5",
        "portée de l'exemption",
        `l'exemption est EXACTE : ${DOIVENT_ETRE_ATTRAPES.length} noms voisins restent attrapés`,
      );
    } else {
      ko(
        "⑫ périmètre A5",
        "portée de l'exemption",
        rates.length > 0
          ? `l'exemption a rendu la garde aveugle sur : ${rates.join(", ")}`
          : `« ${DOIT_ETRE_EXEMPTE} » n'est pas exempté alors qu'il devrait l'être`,
      );
    }
  }

  // ③ (fin) L'exemption ne doit pas survivre à sa colonne : une exemption périmée éteindrait
  // la garde sur un nom que quelqu'un pourrait réintroduire des mois plus tard, en silence.
  // ⚠️ En autotest on injecte une exemption qui ne correspond à AUCUNE colonne : la garde doit
  // la voir. Le message affiche la liste RÉELLEMENT évaluée — un message qui afficherait autre
  // chose que ce qui a été testé serait le 3ᵉ mode de `instrument-non-valide.md` (l'instrument
  // est juste, mais ce qu'il publie n'est pas ce qu'on en lit).
  const perimees = AUTOTEST
    ? ["zz_colonne_qui_n_existe_pas"]
    : Object.keys(EXEMPTIONS_COLONNES).filter((c) => !noms.includes(c));
  if (perimees.length === 0) {
    ok(
      "⑫ périmètre A5",
      "exemptions",
      `${Object.keys(EXEMPTIONS_COLONNES).length} exemption(s), toutes adossées à une colonne réelle`,
    );
  } else {
    ko("⑫ périmètre A5", "exemptions", `exemption(s) PÉRIMÉE(S) : ${perimees.join(", ")} — porte dérobée dormante`);
  }

  // Et AUCUNE TABLE de phase/inscription ne doit exister non plus : le périmètre A5 est fermé
  // au niveau du SCHÉMA, pas seulement de la table. Une story qui créerait `registration` sans
  // toucher à `tournament` passerait la garde ci-dessus sans être vue.
  const tables = await sql<{ nom: string }[]>`
    select table_name as nom from information_schema.tables where table_schema = 'public'`;
  // En autotest, on cherche un motif que le schéma contient forcément (`tournament` lui-même) :
  // la garde doit alors crier.
  const MOTIFS_TABLES = AUTOTEST ? ["tournament"] : ["phase", "match", "registration", "engage"];
  const tablesInterdites = tables
    .map((t) => t.nom)
    .filter((n) => MOTIFS_TABLES.some((i) => n.includes(i)));

  if (tablesInterdites.length === 0) {
    ok("⑫ périmètre A5", "tables du schéma", `${tables.length} tables, aucune de phase ni d'inscription`);
  } else {
    ko("⑫ périmètre A5", "tables du schéma", `table(s) hors périmètre : ${tablesInterdites.join(", ")}`);
  }
}

// ── ⑬  LE GEL DE L'ADRESSE À LA PUBLICATION — GARDE QUI **LIT LE SOURCE**, ET LE DÉCLARE ─
//
// 🔴 CETTE GARDE LIT DU CODE, ELLE NE MESURE PAS UN EFFET, ET C'EST ÉCRIT PLUTÔT QUE CACHÉ.
// La règle A3 (« l'adresse d'un tournoi publié ne change plus ») vit dans une **Server
// Action**, dont l'effet exige une session Discord valide — que cette porte n'a pas et ne peut
// pas fabriquer. Même arbitrage que les deux gardes de `gate:sollicitations` qui lisent le
// source, et il est **déclaré en exemption** plus bas.
// ⚠️ Une garde par `grep` est faible : elle vérifie qu'un texte est présent, pas qu'il produit
// un effet (`pieges/garde-nominale.md`). Elle est conservée parce que le défaut qu'elle attrape
// est celui d'une **SUPPRESSION** — quelqu'un qui « simplifierait » ce bloc en le trouvant
// verbeux —, et une suppression, elle, se voit par un `grep`.
{
  const source = readFileSync(join(RACINE_APP, "src/server/actions/tournois.ts"), "utf8");
  const MARQUEURS = [
    "actuel.isPublished && changeDeSlug",
    "eq(tournament.isPublished, false)",
    "L'adresse d'un tournoi publié ne peut plus changer.",
  ];
  const cherches = AUTOTEST ? ["ZZ-CE-TEXTE-N-EXISTE-PAS"] : MARQUEURS;
  const manquants = cherches.filter((m) => !source.includes(m));

  if (manquants.length === 0) {
    ok("⑬ gel d'adresse", "actions/tournois.ts", "les deux gardes A3 sont présentes dans le source");
  } else {
    ko("⑬ gel d'adresse", "actions/tournois.ts", `absent(s) du source : ${manquants.join(" · ")}`);
  }

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════
   * 🔴 ET LE **MÉCANISME** EST MESURÉ PAR SON EFFET, PAS SEULEMENT LU — AJOUTÉ APRÈS REVUE
   * ══════════════════════════════════════════════════════════════════════════════════════
   *
   * La revue (frontière d'authentification) a trouvé un **TOCTOU** : le contrôle applicatif
   * lisait `is_published` dans une requête et écrivait dans une autre, sans rien entre les
   * deux. Le correctif conditionne l'`UPDATE` sur `is_published = false` **quand l'adresse
   * change**. Ce prédicat-là, contrairement au contrôle applicatif, **est mesurable sans
   * session** : c'est du SQL.
   *
   * ⇒ On l'éprouve **DANS LES DEUX SENS**, ce qu'un `grep` ne fera jamais :
   *   · sur un tournoi **PUBLIÉ**, l'`UPDATE` conditionné doit toucher **0 ligne** ;
   *   · sur un **BROUILLON**, il doit en toucher **1**.
   * Sans le second, une condition qui refuserait TOUT passerait le premier sans qu'on le voie
   * — c'est la même dissymétrie que ⑥ sans ⑦.
   * ⚠️ Ce n'est PAS l'action elle-même (elle exige une session, exemption déclarée) : c'est
   * le prédicat sur lequel elle repose, exercé contre la vraie base.
   */
  try {
    await sql.begin(async (tx) => {
      const idEvenement = await evenementTemoin(tx);

      const [publie] = await tx<{ id: string }[]>`
        insert into tournament (event_id, name, game, slug, starts_at, registration_mode, is_published)
        values (${idEvenement}, 'Gel publie', 'CS2', 'gel-publie', now(), 'interne', true)
        returning id`;
      const [brouillon] = await tx<{ id: string }[]>`
        insert into tournament (event_id, name, game, slug, starts_at, registration_mode, is_published)
        values (${idEvenement}, 'Gel brouillon', 'CS2', 'gel-brouillon', now(), 'interne', false)
        returning id`;

      // En autotest on retire la condition : l'`UPDATE` touche alors la ligne publiée, et la
      // garde doit s'en apercevoir.
      const surPublie = AUTOTEST
        ? await tx`update tournament set slug = 'gel-publie-modifie' where id = ${publie.id} returning id`
        : await tx`update tournament set slug = 'gel-publie-modifie'
                   where id = ${publie.id} and is_published = false returning id`;

      if (surPublie.length === 0) {
        ok("⑬ gel d'adresse", "tournoi PUBLIÉ", "l'UPDATE conditionné touche 0 ligne — l'adresse est gelée");
      } else {
        ko("⑬ gel d'adresse", "tournoi PUBLIÉ", `l'UPDATE a touché ${surPublie.length} ligne(s) — le gel ne tient pas`);
      }

      const surBrouillon = await tx`update tournament set slug = 'gel-brouillon-modifie'
                                    where id = ${brouillon.id} and is_published = false returning id`;

      if (surBrouillon.length === 1) {
        ok("⑬ gel d'adresse", "tournoi BROUILLON", "l'UPDATE conditionné touche 1 ligne — l'adresse reste modifiable");
      } else {
        ko(
          "⑬ gel d'adresse",
          "tournoi BROUILLON",
          `l'UPDATE a touché ${surBrouillon.length} ligne(s) — la condition refuse du légitime`,
        );
      }

      throw new Error("__ROLLBACK__");
    });
  } catch (erreur) {
    const details = erreur as { message?: string };
    if (details.message !== "__ROLLBACK__") {
      ko("⑬ gel d'adresse", "mécanisme SQL", `la transaction a échoué : ${String(erreur)}`);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// ⑭ CE QUE LES PAGES PUBLIQUES SERVENT — **GARDE RETOURNÉE PAR LA STORY 9.2**
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 ELLE N'A PAS ÉTÉ SUPPRIMÉE, ELLE A ÉTÉ RETOURNÉE — c'est ce que son propre commentaire
// exigeait à la Story 9.1 : *« À la Story 9.2, cette garde doit être RETOURNÉE : le témoin
// publié devra apparaître sur `/tournois`, et le brouillon devra rester absent. Ne pas la
// supprimer. »* La supprimer aurait fait disparaître **la seule garde** qui prouve qu'un
// brouillon ne fuit pas sur une page publique.
//
// Ce qu'elle mesure désormais, en trois volets indissociables :
//   ① sur `/tournois`, les DEUX témoins **publiés** apparaissent ;
//   ② le témoin **BROUILLON** n'apparaît **nulle part** — c'est le volet le plus important,
//      parce que sans lui le volet ① serait satisfait même si le filtre `is_published` avait
//      sauté. Un « le publié s'affiche » est vrai d'une page qui affiche TOUT ;
//   ③ la **dérivation** est mesurée sur le rendu, et pas seulement en SQL : le témoin daté
//      dans le FUTUR doit se trouver AVANT la section « Déjà joués », celui daté dans le
//      PASSÉ après. C'est la seule mesure qui prouve qu'un tournoi tombe dans la bonne
//      section — une garde qui se contenterait de « il apparaît » resterait verte si les deux
//      listes étaient interverties.
// ⚠️ Les cinq AUTRES pages publiques ne doivent servir **aucun** tournoi : `/tournois` est la
// seule surface publique de cette donnée avant la fiche (Story 9.3).
//
// 🔴 ET C'EST TOUJOURS LE SEUL BLOC QUI **COMMITE**. Nouveauté de cette story, à dire : le
// temps de la mesure, les deux témoins publiés sont **réellement visibles** sur la page
// publique de staging — ce qui n'était pas le cas à la 9.1, où l'attendu était leur absence
// partout. Le préfixe `ZZ-GATE-` reste donc ce qui permet à un humain de les reconnaître d'un
// coup d'œil, et le ménage vit dans un `finally`.
{
  const marqueSlug = MARQUE.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const slugAVenir = `zz-gate-a-venir-${marqueSlug}`;
  const slugPasse = `zz-gate-passe-${marqueSlug}`;
  const slugBrouillon = `zz-gate-brouillon-${marqueSlug}`;
  const nomAVenir = `${MARQUE}-A-VENIR`;
  const nomPasse = `${MARQUE}-PASSE`;
  const nomBrouillon = `${MARQUE}-BROUILLON`;
  // 🔴 QUATRIÈME TÉMOIN, AJOUTÉ PAR LA STORY 9.3 — il sert la garde ⑳ et rien d'autre : un
  // tournoi **publié** rattaché à un événement **BROUILLON**. Cet état est atteignable et rien
  // ne l'interdit (mesuré : `getEventsPourRattachement` ne filtre pas sur `is_published`, et
  // `actions/tournois.ts` ne couple pas les deux publications).
  const slugEvtCache = `zz-gate-evt-cache-${marqueSlug}`;
  const nomEvtCache = `${MARQUE}-EVT-CACHE`;
  const titreEvtBrouillon = `${MARQUE}-EVT-BROUILLON`;

  /**
   * Marqueur de la SECTION « Déjà joués » dans le HTML servi. C'est l'`id` que la page pose
   * sur son `<h2>` et que sa `<section>` référence en `aria-labelledby` : il est donc porté
   * par l'accessibilité, pas seulement par la porte — le supprimer casserait le rendu bien
   * avant de casser cette mesure.
   * ⚠️ Volontairement PAS un nom de classe CSS Module : celui-là porte un hash qui change à
   * chaque édition du fichier.
   */
  const MARQUEUR_SECTION_PASSES = 'id="passes-title"';

  let idEvenement: string | null = null;
  let idEvenementBrouillon: string | null = null;

  try {
    const [evt] = await sql<{ id: string }[]>`
      insert into event (title, venue_name, starts_at, is_published)
      values (${MARQUE + "-evt"}, 'Salle temoin', now(), true)
      returning id`;
    idEvenement = evt.id;

    // 🔴 LES DATES SONT DÉCALÉES D'UN JOUR DE PART ET D'AUTRE — ET CE CHOIX A ÉTÉ CORRIGÉ EN
    // REVUE. Deux contraintes s'opposent, et ±1 jour est le seul point qui satisfasse les deux :
    //   · ASSEZ LOIN de `now()` pour que le volet ③ soit décidable. À `now()` exactement, un
    //     témoin tombe dans « passés » à la seconde près (frontière `lte` / `gt`), donc la
    //     mesure dépendrait du temps de trajet HTTP. Un jour ne laisse aucune ambiguïté ;
    //   · ASSEZ PRÈS pour être en TÊTE de sa liste. La première version datait les témoins à
    //     ±30 jours — or les lectures publiques sont bornées à 50 lignes et triées par date.
    //     Le jour où 50 tournois réels précèdent le témoin (la Game'in Reims en porte DIX à
    //     elle seule, et les passés s'accumulent indéfiniment par A3), il sortirait du `LIMIT`
    //     et la porte crierait « témoin publié ABSENT » sur un produit parfaitement sain.
    //     🔴 C'est le mode de défaillance chiffré de l'Epic 6 — ~17 instruments faux, TOUS
    //     accusant le produit — fabriqué ici par l'instrument lui-même. À ±1 jour, le témoin à
    //     venir est le PLUS PROCHE (donc premier des ascendants) et le témoin passé le PLUS
    //     RÉCENT (donc premier des descendants) : aucun des deux ne peut être tronqué.
    await sql`insert into tournament (event_id, name, game, slug, starts_at, registration_mode, is_published)
              values (${idEvenement}, ${nomAVenir}, 'CS2', ${slugAVenir}, now() + interval '1 day', 'interne', true)`;
    await sql`insert into tournament (event_id, name, game, slug, starts_at, registration_mode, is_published)
              values (${idEvenement}, ${nomPasse}, 'CS2', ${slugPasse}, now() - interval '1 day', 'interne', true)`;
    // Le brouillon est daté DANS LE FUTUR PROCHE lui aussi : s'il fuyait, il fuirait donc dans
    // la section la plus regardée, en tête de liste. Un témoin de fuite doit être placé là où
    // la fuite serait la plus visible, pas là où elle serait la plus discrète.
    await sql`insert into tournament (event_id, name, game, slug, starts_at, registration_mode, is_published)
              values (${idEvenement}, ${nomBrouillon}, 'CS2', ${slugBrouillon}, now() + interval '2 days', 'interne', false)`;

    // 🔴 LE 4ᵉ TÉMOIN (Story 9.3) : un événement BROUILLON, et un tournoi PUBLIÉ qui lui est
    // rattaché. Le titre de cet événement ne doit apparaître **nulle part** côté public — c'est
    // ce que garde ⑳. ⚠️ Le tournoi est daté à +3 jours : assez proche pour rester dans le
    // `LIMIT` de la liste (même raisonnement que ci-dessus), assez loin des deux autres pour
    // que l'ordre de la page reste lisible à l'œil quand on la regarde pendant la mesure.
    const [evtCache] = await sql<{ id: string }[]>`
      insert into event (title, venue_name, starts_at, is_published)
      values (${titreEvtBrouillon}, 'Salle temoin', now(), false)
      returning id`;
    idEvenementBrouillon = evtCache.id;
    await sql`insert into tournament (event_id, name, game, slug, starts_at, registration_mode, is_published)
              values (${idEvenementBrouillon}, ${nomEvtCache}, 'CS2', ${slugEvtCache}, now() + interval '3 days', 'interne', true)`;

    // Le cas de vérité connue, LU EN PREMIER (leçon 4.2, parade n°8) : si les lignes ne sont
    // pas là, la mesure qui suit ne dit rien du tout.
    // ⚠️ LE COMPTE ATTENDU EST PASSÉ DE 3 À 4 À LA STORY 9.3, avec l'ajout du témoin
    // « rattaché à un événement brouillon ». Un compte laissé à 3 aurait fait crier la garde
    // sur ses propres témoins — l'instrument accusant le produit, une fois de plus.
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from tournament where name like ${MARQUE + "%"}`;
    if (n !== 4) {
      ko("⑭a", "témoins", `${n} témoin(s) en base au lieu de 4 — la mesure ne dit rien`);
    } else {
      ok(
        "⑭a",
        "témoins",
        "4 témoins en base (publié à venir, publié passé, brouillon, publié sur événement brouillon) — la mesure est décidable",
      );

      // ── ⑭a  LES CINQ AUTRES PAGES NE SERVENT AUCUN TOURNOI ─────────────────────────
      //
      // ⚠️ On balaie `PAGES` de la configuration, JAMAIS une liste en dur : un instrument qui
      // liste son périmètre à la main RÉTRÉCIT tout seul à mesure que le projet grandit
      // (défaut mesuré en 5.5 — une sonde prouvait « invisible » sur 3 pages et rien du tout
      // sur les 2 autres, en silence, pendant deux epics). `/tournois` en est retiré ICI, par
      // son nom, et traité juste en dessous : c'est le seul endroit du fichier où une page est
      // nommée, et l'exclure de la boucle est le contraire d'une liste en dur.
      const autresPages = PAGES.filter((p) => p !== PAGE_TOURNOIS);

      // 🔴 LE COMPTE EST DIT, ET C'EST UNE CORRECTION DE REVUE. `PAGES` vient de
      // `GATE_PAGES` : quelqu'un qui lancerait `GATE_PAGES=/tournois` pour itérer plus vite
      // obtiendrait une boucle VIDE, donc ni `ok()` ni `ko()` — ce volet disparaîtrait de la
      // sortie **en silence**. C'est le rétrécissement invisible que ce fichier reproche par
      // ailleurs aux listes en dur (leçon 5.5) : une couverture qui s'évapore sans le dire.
      if (autresPages.length === 0) {
        ko(
          "⑭a",
          "périmètre",
          "AUCUNE autre page à balayer — `GATE_PAGES` est restreint, ce volet n'a rien mesuré",
        );
      } else {
        ok("⑭a", "périmètre", `${autresPages.length} autre(s) page(s) publique(s) balayée(s)`);
      }

      for (const page of autresPages) {
        const r = await demander(page);
        // En autotest, on cherche une chaîne que la page contient forcément : la garde doit
        // alors crier.
        const cherches = AUTOTEST
          ? ["<html"]
          : [nomAVenir, nomPasse, nomBrouillon, slugAVenir, slugPasse, slugBrouillon];
        const vus = cherches.filter((c) => r.corps.includes(c));
        if (vus.length === 0) {
          ok("⑭a", page, "aucun tournoi servi (la seule surface publique est /tournois)");
        } else {
          ko("⑭a", page, `sert un tournoi : ${vus.join(", ")}`);
        }
      }

      // ── ⑭b  SUR `/tournois` : LE PUBLIÉ APPARAÎT, LE BROUILLON NON ──────────────────
      const r = await demander(PAGE_TOURNOIS);
      if (r.statut !== 200) {
        ko("⑭b", PAGE_TOURNOIS, `attendu 200, obtenu ${r.statut} — rien à mesurer`);
      } else {
        // En autotest, on cherche des noms qui ne peuvent PAS être servis : la garde doit
        // conclure « absent » alors qu'elle attend « présent », donc crier.
        const attendusPresents = AUTOTEST
          ? [`${MARQUE}-INEXISTANT-1`, `${MARQUE}-INEXISTANT-2`]
          : [nomAVenir, nomPasse];
        const manquants = attendusPresents.filter((c) => !r.corps.includes(c));
        if (manquants.length === 0) {
          ok("⑭b", PAGE_TOURNOIS, "les DEUX témoins publiés sont servis (à venir + passé)");
        } else {
          ko(
            "⑭b",
            PAGE_TOURNOIS,
            `témoin(s) publié(s) ABSENT(S) : ${manquants.join(", ")} — le filtre is_published ou la dérivation les écarte`,
          );
        }

        // 🔴 LE VOLET LE PLUS IMPORTANT : le brouillon ne doit apparaître ni par son nom, ni
        // par son adresse. Sans lui, le volet ci-dessus serait satisfait par une page qui
        // affiche TOUT — « un publié s'affiche » est vrai d'une fuite complète.
        // En autotest, on lui présente une chaîne que la page contient forcément.
        const interdits = AUTOTEST ? ["<html"] : [nomBrouillon, slugBrouillon];
        const fuites = interdits.filter((c) => r.corps.includes(c));
        if (fuites.length === 0) {
          ok("⑭b", PAGE_TOURNOIS, "le témoin BROUILLON reste absent du HTML servi");
        } else {
          ko(
            "⑭b",
            PAGE_TOURNOIS,
            `FUITE DE BROUILLON : ${fuites.join(", ")} — le filtre is_published a sauté`,
          );
        }

        // ── ⑭c  LA DÉRIVATION EST MESURÉE SUR LE RENDU, PAS SEULEMENT EN SQL ──────────
        //
        // 🔴 CE QU'AUCUNE AUTRE GARDE NE VOIT : que chaque tournoi tombe dans la BONNE
        // section. Les deux listes sortent de deux requêtes jumelles (`gt` / `lte`) ; les
        // intervertir dans la page ne casserait ni le typecheck, ni le build, ni aucune des
        // gardes ci-dessus — la page afficherait simplement les tournois à venir sous le
        // titre « Déjà joués ». C'est un défaut que seul l'œil verrait, et seulement s'il
        // connaissait les dates.
        // 🔴 L'AUTOTEST **ÉCHANGE LES DEUX TÉMOINS**, IL N'INVERSE PAS LE BOOLÉEN — CORRIGÉ
        // EN REVUE, ET LA DIFFÉRENCE EST TOUTE LA VALEUR DE CETTE AUTO-VALIDATION.
        // La première version calculait `correct` sur les données réelles puis lisait
        // `AUTOTEST ? !correct : correct`. Elle prouvait que la branche rouge est ATTEIGNABLE,
        // et rien de plus : si la comparaison elle-même était fausse (un `<` écrit `>`),
        // `correct` vaudrait `false` sur des données pourtant justes, l'autotest lirait
        // `!false = true` et rendrait un ✅ — l'instrument aurait validé son propre défaut.
        // ⇒ Ici on présente aux MÊMES opérateurs une paire réellement inversée : on demande à
        // la garde d'admettre que le témoin PASSÉ est avant la section « Déjà joués » et le
        // témoin À VENIR après. C'est faux dans le HTML servi, donc elle DOIT crier — et elle
        // ne peut le faire que si `<` et `>` sont écrits dans le bon sens.
        const [nomAvantSection, nomApresSection] = AUTOTEST
          ? [nomPasse, nomAVenir]
          : [nomAVenir, nomPasse];

        const iSection = r.corps.indexOf(MARQUEUR_SECTION_PASSES);
        const iAvant = r.corps.indexOf(nomAvantSection);
        const iApres = r.corps.indexOf(nomApresSection);

        if (iSection < 0 || iAvant < 0 || iApres < 0) {
          ko(
            "⑭c",
            `${PAGE_TOURNOIS} (dérivation)`,
            `marqueur de section=${iSection}, attendu-avant=${iAvant}, attendu-après=${iApres} — indécidable`,
          );
        } else if (iAvant < iSection && iApres > iSection) {
          ok(
            "⑭c",
            `${PAGE_TOURNOIS} (dérivation)`,
            `le témoin +1j est AVANT « Déjà joués » (${iAvant} < ${iSection}) et le témoin −1j APRÈS (${iApres} > ${iSection})`,
          );
        } else {
          ko(
            "⑭c",
            `${PAGE_TOURNOIS} (dérivation)`,
            `sections interverties ou témoin mal classé — attendu-avant=${iAvant}, section « Déjà joués »=${iSection}, attendu-après=${iApres}`,
          );
        }

        // ── ⑲a  TOUTE CARTE EST UN LIEN VERS SA FICHE — TÉMOIN DE L'ARBITRAGE A1 INVERSÉ ──
        //
        // 🔴 LE TÉMOIN S'EST INVERSÉ ENTRE LA 9.2 ET LA 9.3, ET C'EST ÉCRIT DES DEUX CÔTÉS :
        // `TournamentList.tsx` annonçait *« aucune carte n'est un lien aujourd'hui, TOUTES le
        // seront dans le commit qui crée la fiche »*. On le mesure sur le HTML SERVI et pas
        // sur le source : un `<Link>` présent dans le TSX ne prouve pas qu'un `href` sorte.
        // ⚠️ Le lien du BROUILLON doit rester absent — il est déjà couvert par ⑭b (le slug y
        // est dans les `interdits`), et c'est voulu : une fuite de brouillon se mesure une
        // fois, au bon endroit, plutôt qu'à moitié à deux endroits.
        const hrefAVenir = `href="/tournois/${slugAVenir}"`;
        const hrefPasse = `href="/tournois/${slugPasse}"`;
        // En autotest, on exige des `href` qui ne peuvent PAS être servis : la garde doit crier.
        const hrefsAttendus = AUTOTEST
          ? [`href="/tournois/zz-gate-inexistant-1"`, `href="/tournois/zz-gate-inexistant-2"`]
          : [hrefAVenir, hrefPasse];
        const hrefsManquants = hrefsAttendus.filter((h) => !r.corps.includes(h));
        if (hrefsManquants.length === 0) {
          ok(
            "⑲a",
            PAGE_TOURNOIS,
            "les DEUX cartes publiées portent un lien vers leur fiche (A1 inversé, mesuré sur le HTML servi)",
          );
        } else {
          ko(
            "⑲a",
            PAGE_TOURNOIS,
            `lien(s) de fiche ABSENT(S) : ${hrefsManquants.join(", ")} — les cartes ont cessé d'être des liens, ` +
              "et la résolution de `resoudreFicheTournoi` devient muette avec elles",
          );
        }
      }

      // ══════════════════════════════════════════════════════════════════════════════════
      // ⑲b LA FICHE SERT LE PUBLIÉ ET **404** LE BROUILLON — DANS LES DEUX SENS (Story 9.3)
      // ══════════════════════════════════════════════════════════════════════════════════
      //
      // 🔴 LES DEUX MOITIÉS SONT INDISSOCIABLES, ET LA SECONDE EST CELLE QUI COMPTE. « La
      // fiche d'un tournoi publié répond 200 » est vrai d'une route qui sert TOUT ; c'est le
      // 404 sur le brouillon qui prouve le filtre `is_published`. Une route qui aurait perdu
      // son filtre laisserait la première moitié verte, et **aucune porte visuelle ne le
      // verrait** : une page qui s'affiche n'a pas l'air cassée.
      //
      // 🔴 ET L'ATTENDU EST **404, JAMAIS 403** — ce n'est pas un détail de code de statut.
      // Un 403 CONFIRME l'existence de ce qu'il refuse : il dirait au curieux qu'un tournoi se
      // prépare sous ce nom. C'est la doctrine de `/medias/[filename]` (Story 6.4), tenue ici
      // sur la première route dynamique publique du site. La garde refuse donc explicitement
      // 403, au lieu de se contenter de « pas 200 ».
      {
        const fichePubliee = await demander(`/tournois/${slugAVenir}`);
        const attenduNom = AUTOTEST ? `${MARQUE}-INEXISTANT` : nomAVenir;
        if (fichePubliee.statut === 200 && fichePubliee.corps.includes(attenduNom)) {
          ok("⑲b", `/tournois/${slugAVenir}`, "200 et la fiche porte le nom du tournoi publié");
        } else {
          ko(
            "⑲b",
            `/tournois/${slugAVenir}`,
            `attendu 200 + le nom « ${attenduNom} » — obtenu ${fichePubliee.statut}, nom ${
              fichePubliee.corps.includes(attenduNom) ? "présent" : "ABSENT"
            }`,
          );
        }

        // En autotest on interroge la fiche du tournoi PUBLIÉ en prétendant attendre un 404 :
        // elle répond 200, donc la garde doit crier. On ne bascule PAS un booléen — on lui
        // présente un cas réellement inverse (leçon ⑭c, corrigée en revue à la 9.2).
        const slugInterroge = AUTOTEST ? slugAVenir : slugBrouillon;
        const ficheBrouillon = await demander(`/tournois/${slugInterroge}`);
        if (ficheBrouillon.statut === 404) {
          ok("⑲b", `/tournois/${slugInterroge}`, "404 — le brouillon n'a pas d'adresse publique");
        } else if (ficheBrouillon.statut === 403) {
          ko(
            "⑲b",
            `/tournois/${slugInterroge}`,
            "403 au lieu de 404 — un refus qui CONFIRME l'existence du brouillon (doctrine 6.4)",
          );
        } else {
          ko(
            "⑲b",
            `/tournois/${slugInterroge}`,
            `attendu 404, obtenu ${ficheBrouillon.statut} — le filtre is_published de la fiche a sauté`,
          );
        }

        // ⚠️ Un slug qui n'a JAMAIS existé doit répondre comme un brouillon : sans ce cas, on
        // ne saurait pas si le 404 ci-dessus vient du filtre ou d'un `notFound()` systématique.
        const slugInconnu = AUTOTEST ? slugAVenir : `zz-gate-slug-qui-nexiste-pas-${marqueSlug}`;
        const ficheInconnue = await demander(`/tournois/${slugInconnu}`);
        if (ficheInconnue.statut === 404) {
          ok("⑲b", `/tournois/${slugInconnu}`, "404 sur un slug inexistant");
        } else {
          ko(
            "⑲b",
            `/tournois/${slugInconnu}`,
            `attendu 404, obtenu ${ficheInconnue.statut} — un slug inconnu ne doit rien servir`,
          );
        }
      }

      // ══════════════════════════════════════════════════════════════════════════════════
      // ⑳ UN ÉVÉNEMENT **BROUILLON** N'EST NOMMÉ NULLE PART CÔTÉ PUBLIC (Story 9.3)
      // ══════════════════════════════════════════════════════════════════════════════════
      //
      // 🔴 CE QU'AUCUNE AUTRE GARDE NE COUVRE, ET QUE RIEN N'INTERDIT EN BASE. Mesuré le
      // 2026-08-14 : `getEventsPourRattachement` **ne filtre pas** sur `is_published` (à
      // dessein — on prépare la Game'in Reims des semaines à l'avance) et `actions/tournois.ts`
      // ne **couple pas** la publication d'un tournoi à celle de son événement. Un tournoi
      // publié rattaché à un événement brouillon est donc parfaitement atteignable.
      // ⇒ Si la fiche nommait son événement sans vérifier, elle **publierait le titre d'un
      // brouillon d'agenda**. Et **aucune porte visuelle ne le verrait** : une page qui affiche
      // une ligne de plus n'a pas l'air cassée. C'est une fuite de la même famille que celle
      // du filtre `is_published`, mais elle passe par une RELATION — d'où sa propre garde.
      {
        const fiche = await demander(`/tournois/${slugEvtCache}`);
        // En autotest, on cherche une chaîne que la page contient forcément : la garde doit
        // conclure « fuite » et crier.
        const interdit = AUTOTEST ? "<html" : titreEvtBrouillon;
        if (fiche.statut !== 200) {
          ko(
            "⑳",
            `/tournois/${slugEvtCache}`,
            `attendu 200 (le TOURNOI est publié, seul son événement ne l'est pas) — obtenu ${fiche.statut}`,
          );
        } else if (fiche.corps.includes(interdit)) {
          ko(
            "⑳",
            `/tournois/${slugEvtCache}`,
            `FUITE : le titre de l'événement BROUILLON « ${interdit} » est servi sur une page publique`,
          );
        } else {
          ok(
            "⑳",
            `/tournois/${slugEvtCache}`,
            "le tournoi est servi, et le titre de son événement brouillon reste absent",
          );
        }
      }
    }
  } finally {
    // 🔴 DANS UN `finally` : le ménage doit avoir lieu même si la porte lève. C'est la seule
    // écriture réellement commitée de cette porte (voir l'en-tête, précaution ②).
    // ⚠️ L'ORDRE COMPTE : `tournament.event_id` est en `ON DELETE RESTRICT`, donc Postgres
    // REFUSERAIT de supprimer les événements tant que leurs tournois existent. Les tournois
    // partent d'abord — et c'est le bon signal, pas un contournement (le raisonnement complet
    // vit sur la colonne dans `schema.ts`).
    await sql`delete from tournament where name like ${MARQUE + "%"}`;
    if (idEvenement) await sql`delete from event where id = ${idEvenement}`;
    if (idEvenementBrouillon) await sql`delete from event where id = ${idEvenementBrouillon}`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// ⑯ LE VISUEL VIENT DE LA GALERIE — **AUCUNE 4ᵉ FAMILLE DE MÉDIAS** (arbitrage A2)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 CETTE GARDE PROTÈGE UNE **ABSENCE**, ET C'EST LA SEULE CHOSE QUI LA TIENDRA DANS SIX MOIS.
// Mesuré le 2026-08-13 : `src/app/medias/` porte **trois** familles (`[filename]`, `logos/`,
// `portraits/`). Quelqu'un ajoutera un jour « juste une route pour les visuels de tournoi,
// c'est plus propre » — et rouvrira le piège de la Story 6.5 : *les routes de médias ne
// connaissent que leur propre table*, donc un fichier posé sans ligne correspondante rend
// **404 EN SILENCE**. L'arbitrage A2 existe précisément pour éviter cette route.
// ⚠️ La garde vérifie AUSSI que la clé étrangère pointe bien `photo` : une colonne `photo_id`
// qui ne référencerait rien serait un identifiant orphelin, c'est-à-dire la même panne par un
// autre chemin.
{
  const familles = readdirSync(join(RACINE_APP, "src/app/medias"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  const ATTENDUES = AUTOTEST ? ["logos"] : ["[filename]", "logos", "portraits"];

  if (JSON.stringify(familles) === JSON.stringify(ATTENDUES)) {
    ok("⑯ A2 — visuel", "src/app/medias/", `${familles.length} familles de médias, inchangé : ${familles.join(", ")}`);
  } else {
    ko(
      "⑯ A2 — visuel",
      "src/app/medias/",
      `attendu [${ATTENDUES.join(", ")}], trouvé [${familles.join(", ")}] — une famille de plus rouvre le 404 silencieux de la 6.5`,
    );
  }

  const [fk] = await sql<{ cible: string; action: string }[]>`
    select ccu.table_name as cible, rc.delete_rule as action
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
    join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
    where tc.table_name = 'tournament' and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = ${AUTOTEST ? "event_id" : "photo_id"}`;

  // 🔴 `SET NULL` ET NON `CASCADE` : supprimer une photo de la galerie ne doit pas effacer un
  // tournoi, son podium et son adresse publique. Le tournoi perd son visuel, et c'est tout.
  if (fk?.cible === "photo" && fk.action === "SET NULL") {
    ok("⑯ A2 — visuel", "tournament.photo_id", "référence `photo` en ON DELETE SET NULL");
  } else {
    ko(
      "⑯ A2 — visuel",
      "tournament.photo_id",
      `attendu photo/SET NULL, trouvé ${fk?.cible ?? "aucune FK"}/${fk?.action ?? "—"}`,
    );
  }
}

// ── ⑰  PAS D'ÉVÉNEMENT ⇒ UN LIEU — LA CONTRAINTE, LUE DANS SON TEXTE (Story 9.5) ──────
//
// 🔴 LA SEULE GARDE QUI PUISSE VOIR CE DÉFAUT, ET ELLE NE PASSE PAS PAR UNE ÉCRITURE.
// La 9.5 rend `event_id` **nullable**, ce qui rouvre exactement le trou qu'`event_has_venue`
// a laissé ouvert **trois epics et sept portes vertes** : la forme naïve
//     `event_id is not null or length(btrim(venue_name)) > 0`
// vaut `FALSE OR NULL` = **`NULL`** dans le cas précis qu'elle interdit — et un `CHECK` qui
// vaut `NULL` **PASSE**. Retirer le `coalesce` laisserait donc la contre-épreuve « les deux
// colonnes à NULL » **VERTE** : le défaut rend l'écriture aveugle **par construction**
// (leçon `gate:ateliers` ⑧, prouvée rouge). ⇒ On LIT `pg_get_constraintdef`.
//
// 🔴 ET ELLE VÉRIFIE **DEUX** CHOSES, PAS UNE — la seconde est le piège
// `pieges/contrainte-degeneree.md` appliqué à cette story. Si quelqu'un remettait un
// `NOT NULL` sur `event_id`, la contrainte deviendrait **toujours vraie** : toujours là,
// toujours satisfaite, ne protégeant plus rien, **sans qu'aucun test ne rougisse**. Une
// contrainte conditionnelle ne vaut que par la nullabilité de la colonne qui la conditionne.
{
  const [colonne] = await sql<{ nullable: string }[]>`
    select is_nullable as nullable from information_schema.columns
    where table_name = 'tournament' and column_name = 'event_id'`;

  // En autotest, on exige l'inverse de la réalité : la garde doit voir la divergence.
  const attenduNullable = AUTOTEST ? "NO" : "YES";
  if (colonne?.nullable === attenduNullable) {
    ok("⑰ pas d'événement ⇒ un lieu", "tournament.event_id", "la colonne est NULLABLE (9.5)");
  } else {
    ko(
      "⑰ pas d'événement ⇒ un lieu",
      "tournament.event_id",
      `attendu is_nullable=${attenduNullable}, trouvé ${colonne?.nullable ?? "colonne absente"} — ` +
        "si la colonne redevient NOT NULL, `tournament_a_un_lieu` est TOUJOURS vraie : elle ne garde plus rien",
    );
  }

  const [contrainte] = await sql<{ definition: string }[]>`
    select pg_get_constraintdef(oid) as definition from pg_constraint
    where conrelid = 'tournament'::regclass and conname = 'tournament_a_un_lieu'`;

  if (!contrainte) {
    ko(
      "⑰ pas d'événement ⇒ un lieu",
      "tournament_a_un_lieu",
      "la contrainte N'EXISTE PAS — un tournoi sans événement peut n'avoir aucun lieu et s'afficher sans dire où",
    );
  } else {
    const definition = contrainte.definition;
    // En autotest, on exige une formule qui n'y est pas : la garde doit le voir.
    const motifNullSafe = AUTOTEST ? /nullif\s*\(/i : /coalesce\s*\(/i;
    if (motifNullSafe.test(definition) && /venue_name/i.test(definition)) {
      ok(
        "⑰ pas d'événement ⇒ un lieu",
        "tournament_a_un_lieu",
        "NULL-SAFE — la longueur est enveloppée, le CHECK ne peut plus valoir NULL",
      );
    } else {
      ko(
        "⑰ pas d'événement ⇒ un lieu",
        "tournament_a_un_lieu",
        `la contrainte n'est PAS null-safe — elle vaudra NULL, donc PASSERA. Texte lu : ${definition}`,
      );
    }
    // ⚠️ Le membre `event_id is not null` doit être là, sinon la règle ne dit plus « PAS
    // d'événement ⇒ un lieu » mais « toujours un lieu » — ce qui refuserait les tournois
    // rattachés dont le lieu vient de leur événement (cas nominal de la Game'in Reims).
    // ⚠️ En autotest on exige `IS NULL` (jamais présent) : sans cette inversion, cette
    // sous-assertion serait la seule de la garde à ne recevoir AUCUN cas d'échec — elle
    // resterait verte quoi qu'il arrive, et la couverture calculée ne le dirait pas, puisque
    // celle-ci se compte par ÉTIQUETTE de garde et que les deux autres rougissent déjà.
    if (new RegExp(AUTOTEST ? "event_id IS NULL" : "event_id IS NOT NULL", "i").test(definition)) {
      ok(
        "⑰ pas d'événement ⇒ un lieu",
        "tournament_a_un_lieu",
        "conditionnelle au rattachement — un tournoi rattaché n'a pas à répéter le lieu de son événement",
      );
    } else {
      ko(
        "⑰ pas d'événement ⇒ un lieu",
        "tournament_a_un_lieu",
        `la branche « rattaché » manque : la règle deviendrait « TOUJOURS un lieu ». Texte lu : ${definition}`,
      );
    }
  }
}

// ── ⑰bis  L'EFFET, DANS LES TROIS CAS — UN REFUS, DEUX ACCEPTATIONS ───────────────────
//
// 🔴 LA LECTURE DU TEXTE (⑰) ET L'ÉCRITURE (⑰bis) NE SE REMPLACENT PAS — ELLES SE COMPLÈTENT,
// ET C'EST LA LEÇON `gate:ateliers` ⑧ PRISE DANS LES DEUX SENS :
//   · l'écriture seule est **aveugle à la null-safety** (le défaut la rend verte) ⇒ ⑰ ;
//   · la lecture seule ne prouve pas que la contrainte **est appliquée** — un texte juste sur
//     une contrainte `NOT VALID`, ou détachée par une migration, passerait ⑰ sans rien garder.
// ⚠️ ET LES DEUX ACCEPTATIONS COMPTENT AUTANT QUE LE REFUS : sans elles, une contrainte qui
// refuserait **tout** serait indiscernable d'une contrainte juste (patron de la garde ⑦).
{
  const CAS_LIEU: { quoi: string; refus: boolean; rattache: boolean; lieu: string | null }[] = [
    { quoi: "sans événement ET sans lieu", refus: true, rattache: false, lieu: null },
    // ⚠️ Ce cas-ci est attrapé par `tournament_venue_name_valide` AVANT `tournament_a_un_lieu`,
    // et c'est sans importance : ce qu'on éprouve est l'EFFET (un tel tournoi ne doit pas
    // exister), pas quelle contrainte le refuse. Le nom vu est rapporté dans le message.
    { quoi: "sans événement, blancs ASCII pour lieu", refus: true, rattache: false, lieu: "   " },
    { quoi: "sans événement, AVEC un lieu", refus: false, rattache: false, lieu: "En ligne" },
    { quoi: "AVEC événement, sans lieu", refus: false, rattache: true, lieu: null },
  ];

  for (const cas of CAS_LIEU) {
    // En autotest, on inverse le verdict attendu : la garde doit voir la divergence.
    const refusAttendu = AUTOTEST ? !cas.refus : cas.refus;
    let accepte = false;
    let vu = "?";
    try {
      await sql.begin(async (tx) => {
        const idEvenement = cas.rattache ? await evenementTemoin(tx) : null;
        await tx`insert into tournament (event_id, name, game, slug, starts_at, registration_mode, venue_name)
                 values (${idEvenement}, ${MARQUE + "-lieu"}, 'CS2', ${MARQUE.toLowerCase() + "-lieu"},
                         now(), 'interne', ${cas.lieu})`;
        accepte = true;
        // Annulation systématique : cette garde ne laisse RIEN derrière elle (garde ⑮).
        throw new Error("__ROLLBACK__");
      });
    } catch (erreur) {
      const details = erreur as { message?: string; code?: string; constraint_name?: string };
      if (details.message !== "__ROLLBACK__") {
        vu = details.constraint_name ?? details.code ?? "?";
      }
    }

    if (accepte === !refusAttendu) {
      ok(
        "⑰bis effet du lieu",
        cas.quoi,
        accepte ? "accepté, comme il se doit" : `refusé par ${vu}`,
      );
    } else {
      ko(
        "⑰bis effet du lieu",
        cas.quoi,
        refusAttendu
          ? "ACCEPTÉ alors qu'il devait être refusé — un tournoi peut s'afficher sans dire où il se tient"
          : `REFUSÉ (${vu}) alors qu'il devait passer — la contrainte est trop large`,
      );
    }
  }
}

// ── ⑱  AUCUNE VALEUR D'ENUM « tournoi » — LA NATURE SE DÉRIVE (arbitrage A2, Story 9.5) ─
//
// 🔴 GARDE D'**ABSENCE**, ET C'EST LA SEULE FAÇON DE LA TENIR. « Cet événement porte-t-il un
// tournoi ? » se **dérive** de la relation `event.tournaments`, qui existe depuis la 9.1.
// Ajouter une valeur `tournoi` à `event_type` fabriquerait une **seconde source** du même
// fait — et deux sources divergent : un `type = tournoi` dont le tournoi a été supprimé, un
// tournoi rattaché à un `thursday`. Le rendu ne saurait plus laquelle croire.
//
// ⚠️ ET LE COÛT SERAIT HORS DE CE DÉPÔT : `EVENT_TYPES` alimente le **contrat envoyé à n8n**
// (`lib/schemas/publication.ts`, `type: z.enum(EVENT_TYPES)`). Une valeur de plus modifierait
// un contrat d'intégration tierce pour un fait qu'on sait déduire.
//
// 🔴 LA LISTE ATTENDUE N'EST PAS RECOPIÉE ICI — elle est **importée** de `EVENT_TYPES`, la
// même constante qui construit le `pgEnum` et le schéma Zod. Une énumération alignée à la main
// se désaligne à l'ajout suivant : ce projet l'a payé cinq fois (`_sections.ts`, `CHAMPS_URL`,
// la couverture d'autotest de `gate:reseaux`, la liste `INTERDITS` de cette porte, le compte
// de colonnes nullables de `schema.ts`).
{
  const valeurs = await sql<{ valeur: string }[]>`
    select e.enumlabel as valeur from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'event_type'
    order by e.enumsortorder`;
  const enBase = valeurs.map((v) => v.valeur);
  // En autotest, on attend une liste volontairement fausse : la garde doit le voir.
  const attendues = AUTOTEST ? [...EVENT_TYPES, "tournoi"] : [...EVENT_TYPES];

  if (JSON.stringify(enBase) === JSON.stringify(attendues)) {
    ok("⑱ A2 — nature dérivée", "enum event_type", `${enBase.length} valeurs, inchangé : ${enBase.join(", ")}`);
  } else {
    ko(
      "⑱ A2 — nature dérivée",
      "enum event_type",
      `attendu [${attendues.join(", ")}], trouvé [${enBase.join(", ")}] — une valeur « tournoi » ferait DEUX sources du même fait, et toucherait le contrat n8n`,
    );
  }
}

// ── ㉑  AUCUNE PAGE PUBLIQUE N'ENVOIE PLUS VERS L'ANCIENNE PLATEFORME (Story 9.4) ──────
//
// 🔴 CE QUE CETTE GARDE TIENT, ET POURQUOI ELLE EXISTE. Jusqu'au 2026-08-14, le chrome du
// site servait **29 ancres** vers `https://tournoi.esportdessacres.fr` — 5 sur `/`, 4 sur
// chacune des six autres pages —, c'est-à-dire vers une application que plus personne ne
// maintient (arbitrage A18) et qui affiche un tournoi TFT terminé. `/tournois` elle-même en
// portait quatre, dans son propre en-tête et son propre pied de page.
//
// ⚠️ LE COMPTE DE 29 N'ÉTAIT PAS CELUI DES DOCUMENTS. `epics.md` et la note d'architecture
// annonçaient « 6 consommateurs », avec une ellipse qui trahissait un compte jamais fermé. Le
// vrai relevé : 3 fichiers, 5 sites de code — et **deux ancres rendues par site d'en-tête**,
// parce que `MobileMenu` rend `NAV_LINKS` DEUX fois (barre desktop + panneau mobile, toujours
// monté et seulement `hidden`). Cet écart n'est visible dans AUCUN fichier : il ne se voit que
// sur le HTML servi. D'où cette garde, qui compte là où la vérité est.
//
// 🔴 ELLE MESURE LE MARKUP SEUL. Un `grep` sur le HTML de Next compte AUSSI la charge RSC
// (`<script>self.__next_f.push(…)`) : mesuré le 2026-08-14, 24 occurrences de « nouvel onglet »
// sur `/` contre 15 dans le markup. Un témoin qui compte deux fois la même chose bouge pour une
// raison qui n'est pas la sienne.
//
// ⚠️ CE QU'ELLE NE COUVRE PAS, ET ELLE LE DIT : la fiche `/tournois/<slug>` n'est pas dans
// `PAGES` (route dynamique, résolue ailleurs). Son chrome est le MÊME composant — le risque
// couvert ici est donc le même —, et `gate:links` ⑧a la balaie, elle. Ce n'est pas une raison
// de croire cette garde exhaustive.
{
  // En autotest on cherche une chaîne que toute page contient forcément : la garde doit crier.
  const CIBLE = AUTOTEST ? 'href="/' : 'href="https://tournoi.esportdessacres.fr"';
  const sansScripts = (html: string) =>
    html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

  if (PAGES.length === 0) {
    ko("㉑ ancien hôte", "périmètre", "`GATE_PAGES` est vide — RIEN À MESURER, et ce n'est pas un succès");
  } else {
    ok("㉑ ancien hôte", "périmètre", `${PAGES.length} page(s) publique(s) balayée(s)`);
  }

  let total = 0;
  for (const page of PAGES) {
    const r = await demander(page);
    if (r.statut !== 200) {
      ko("㉑ ancien hôte", page, `attendu 200, obtenu ${r.statut} — rien à mesurer sur cette page`);
      continue;
    }
    const n = (sansScripts(r.corps).match(new RegExp(CIBLE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
    total += n;
    if (n === 0) {
      ok("㉑ ancien hôte", page, "aucune ancre vers `tournoi.esportdessacres.fr`");
    } else {
      ko(
        "㉑ ancien hôte",
        page,
        AUTOTEST
          ? `attendu inversé (autotest) : ${n} ancre(s) trouvée(s) pour « ${CIBLE} » — la garde voit donc bien ce qu'on lui présente`
          : `${n} ancre(s) mènent encore à l'ancienne plateforme (abandonnée, A18) — le chrome doit pointer vers /tournois`,
      );
    }
  }
  if (!AUTOTEST && total === 0) {
    ok("㉑ ancien hôte", "total", "0 ancre sur l'ensemble du site — il y en avait 29 avant la Story 9.4");
  }
}

// ── ⑮  MÉNAGE : LA PORTE NE LAISSE RIEN DERRIÈRE ELLE ─────────────────────────────────
//
// 🔴 GARDE NÉE D'UN DÉFAUT RÉEL DE `gate:partenaires` : elle POLLUAIT le volume qu'elle
// mesurait, EN RESTANT VERTE. Une porte qui salit ce qu'elle observe finit par mesurer ses
// propres traces — et ici elle salirait la base où des administrateurs de l'association
// saisissent du contenu réel, sans sauvegarde derrière (voir l'en-tête).
// ⚠️ LES DEUX TABLES SONT COMPTÉES : la porte fabrique des `event`, pas seulement des
// `tournament`. Ne compter que la seconde laisserait passer exactement la moitié des fuites.
const apresMenage = await compter();
{
  const dTournois = apresMenage.tournois - avantMenage.tournois;
  const dEvenements = apresMenage.evenements - avantMenage.evenements;
  if (dTournois === 0 && dEvenements === 0) {
    ok(
      "⑮ ménage",
      "tournament + event",
      `${avantMenage.tournois}/${avantMenage.evenements} → ${apresMenage.tournois}/${apresMenage.evenements} : rien laissé derrière`,
    );
  } else {
    ko(
      "⑮ ménage",
      "tournament + event",
      `la porte a laissé ${dTournois} tournoi(s) et ${dEvenements} événement(s) — les chercher par le préfixe « ${MARQUE} »`,
    );
  }
}

await sql.end();

// ══════════════════════════════════════════════════════════════════════════════════════
// EXEMPTIONS — CE QUE CETTE PORTE NE COUVRE PAS, DIT EN SORTIE
// ══════════════════════════════════════════════════════════════════════════════════════
exemptions.add(
  "L'APPARENCE des écrans de tournois — back-office ET page publique `/tournois` (ton, " +
    "rythme, hiérarchie, lisibilité des cartes, rendu sans visuel) — c'est le gate visuel de " +
    "Brice, et la passe 1 ne s'outille pas (rétro Epic 5).",
);
exemptions.add(
  "🔴 DE LA PAGE `/tournois`, LA GARDE ⑭ MESURE **QUI EST SERVI** ET **DANS QUELLE " +
    "SECTION** — pas ce que chaque carte MONTRE. Que le jeu, le lieu, l'état des " +
    "inscriptions ou le podium soient rendus au bon endroit et au bon moment (podium sur " +
    "les passés seulement, état des inscriptions sur les à venir seulement) n'est vérifié " +
    "par aucune garde : le contenu d'une carte se lit à l'œil, sur staging. " +
    "⚠️ Ce qui EST couvert malgré tout : qu'un nom de tournoi publié soit servi, qu'un " +
    "brouillon ne le soit pas, et que les deux sections ne soient pas interverties.",
);
exemptions.add(
  "🔴 LE VOLET ③ DE LA GARDE ⑭ S'APPUIE SUR UN MARQUEUR NOMINAL — `id=\"passes-title\"` dans " +
    "le HTML servi. C'est une garde de NOM, pas de contrat (`pieges/garde-nominale.md`) : " +
    "elle serait aveugle si la page rendait ce même id ailleurs. Le choix est assumé et " +
    "borné — cet `id` est porté par l'`aria-labelledby` de la section, donc le supprimer " +
    "casse l'accessibilité bien avant de casser la mesure, et Lighthouse le verrait. " +
    "L'alternative (mesurer par nom de classe CSS Module) serait PIRE : son hash change à " +
    "chaque édition du fichier.",
);
exemptions.add(
  "🔴 DU GEL D'ADRESSE (A3), LA GARDE ⑬ MESURE LE **MÉCANISME** ET NON L'**ACTION**. Le " +
    "prédicat SQL (`… and is_published = false`) est éprouvé par son EFFET, dans les deux " +
    "sens — 0 ligne sur un publié, 1 ligne sur un brouillon. Ce qui reste NON couvert : le " +
    "contrôle applicatif qui rend le message au bénévole, et l'ORDRE des deux (lecture puis " +
    "écriture conditionnée). Ils vivent dans une Server Action, dont l'effet exige une " +
    "session Discord que cette porte n'a pas ; seule leur PRÉSENCE est vérifiée, par lecture " +
    "du source — ce qui attrape une suppression, pas une réécriture inopérante." +
    " ⚠️ Cette exemption disait « N'EST PAS MESURÉ PAR SON EFFET » jusqu'à ce que la revue " +
    "trouve le TOCTOU : elle était vraie au premier commit de la story et fausse au dernier.",
);
exemptions.add(
  "🔴 QUE LE RATTACHEMENT SOIT LE BON. La base garantit qu'un tournoi non rattaché a un LIEU " +
    "(garde ⑰) ; elle ne peut rien contre un tournoi rattaché au MAUVAIS événement. C'est " +
    "l'écran qui le couvre, en affichant l'événement — ou son absence — sur chaque ligne, et " +
    "le gate visuel qui le voit. ⚠️ CETTE EXEMPTION DISAIT « la base garantit qu'un tournoi A " +
    "UN événement (A4) » : vraie jusqu'au 2026-08-13, FAUSSE depuis la Story 9.5, qui rend " +
    "`event_id` facultatif. Une exemption est un fait daté comme un autre.",
);
exemptions.add(
  "🔴 QUE `ON DELETE RESTRICT` PRODUISE UN MESSAGE UTILISABLE. La contrainte est éprouvée " +
    "(la suppression d'un événement porteur échoue), mais la TRADUCTION de ce refus vit dans " +
    "`actions/agenda.ts` et exige une session. Vérifiée au gate visuel, pas ici.",
);
exemptions.add(
  "La COMPOSITION des Server Actions (dérivation de l'adresse, message de collision, " +
    "avertissement de changement d'heure). Ces chemins exigent une session : ils sont " +
    "couverts par le gate visuel, pas ici.",
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
console.log(
  `  🧹 tournament : ${avantMenage.tournois} → ${apresMenage.tournois} · ` +
    `event : ${avantMenage.evenements} → ${apresMenage.evenements} (après ménage).`,
);

if (AUTOTEST) {
  if (echecs.length === 0) {
    console.log("\n🔴 AUTO-VALIDATION ÉCHOUÉE — chaque garde a reçu un cas qu'elle devait voir,");
    console.log("   et la porte reste verte. L'instrument ne mesure rien : ne pas s'y fier.");
    process.exit(1);
  }
  console.log(`\n✅ INSTRUMENT VALIDE — ${echecs.length} garde(s) ont vu le cas qu'on leur présentait.`);
  // 🔴 ET CE QUE L'AUTOTEST NE PROUVE PAS EST DIT ICI, ET **CALCULÉ**, JAMAIS ÉNUMÉRÉ À LA
  // MAIN. Leçon de `gate:reseaux` : la version écrite à la main annonçait « quatre gardes non
  // éprouvées » — il y en avait **dix-sept**. Une auto-validation qui déclare mal sa propre
  // couverture est la forme la plus discrète de `pieges/instrument-non-valide.md`.
  const eprouvees = new Set(echecs.map((e) => e.split(" ")[0]));
  const toutes = new Set([...echecs, ...succes].map((e) => e.split(" ")[0]));
  const nonEprouvees = [...toutes].filter((g) => !eprouvees.has(g)).sort();
  console.log(`\n   📐 COUVERTURE CALCULÉE : ${eprouvees.size} garde(s) sur ${toutes.size} ont rougi.`);
  if (nonEprouvees.length > 0) {
    console.log(`   ⚠️  ${nonEprouvees.length} GARDE(S) SANS CAS D'AUTO-VALIDATION : ${nonEprouvees.join(", ")}`);
    console.log("      Leur verdict vert repose sur leur lecture, pas sur une mesure d'échec.");
  }
  process.exit(0);
}

if (echecs.length > 0) {
  console.log(`\n🔴 ${echecs.length} GARDE(S) EN ÉCHEC.`);
  process.exit(1);
}
console.log(`\n✅ ${succes.length} GARDE(S) VERTE(S).`);
process.exit(0);
