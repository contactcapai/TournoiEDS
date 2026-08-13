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
//   un tournoi servi sur une page publique alors qu'AUCUNE ne le doit     ❌        ❌      ❌  ⚠️
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
//   ② **une seule chose est réellement COMMITÉE** : le trio témoin (1 événement + 2 tournois)
//      dont la garde ⑩ a besoin pour être visible en HTTP. Il est supprimé dans un `finally`,
//      donc y compris si la porte échoue ou lève ;
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
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

import { BASE as BASE_DEFAUT, PAGES } from "./config.mjs";
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

/** Préfixe de TOUS les témoins de cette porte — reconnaissable par un humain (voir l'en-tête). */
const MARQUE = `ZZ-GATE-${Date.now().toString(36).toUpperCase()}`;

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

function lireVariable(nom: string): string | null {
  try {
    const contenu = readFileSync(join(RACINE_APP, ".env.local"), "utf8");
    const ligne = contenu.split(/\r?\n/).find((l) => l.trim().startsWith(`${nom}=`));
    return ligne ? ligne.slice(ligne.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

// 🔴 L'ENVIRONNEMENT EST PRIORITAIRE SUR `.env.local`, ET C'EST NOUVEAU DEPUIS CETTE STORY.
// Les six portes de modèle antérieures lisaient `.env.local` **seulement** : elles étaient
// écrites quand un Postgres local tournait. Depuis le 2026-08-13 il n'y en a plus, et c'est
// `DATABASE_URL=… pnpm --filter vitrine gate:tournois` qui vise staging. Le repli sur
// `.env.local` reste, pour qu'un poste qui rallumerait une base locale continue de marcher.
const urlBase = process.env.DATABASE_URL ?? lireVariable("DATABASE_URL");
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
    {
      quoi: "événement de rattachement ABSENT (A4 : obligatoire)",
      valeur: { ...BASE_VALIDE, eventId: "" },
      doitPasser: false,
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
    "registration_count",
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

  const cherchees = AUTOTEST ? ["name"] : INTERDITS;
  const trouves = noms.filter((n) => cherchees.some((i) => n.includes(i)));

  if (trouves.length === 0) {
    ok("⑫ périmètre A5", "colonnes de tournament", `aucune colonne de phase, d'inscrit ni d'engagé (${noms.length} colonnes)`);
  } else {
    ko("⑫ périmètre A5", "colonnes de tournament", `colonne(s) hors périmètre : ${trouves.join(", ")} — la racine minimale ne l'est plus`);
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
    "actuel.isPublished && actuel.slug !== valeurs.slug",
    "L'adresse d'un tournoi publié ne peut plus changer.",
  ];
  const cherches = AUTOTEST ? ["ZZ-CE-TEXTE-N-EXISTE-PAS"] : MARQUEURS;
  const manquants = cherches.filter((m) => !source.includes(m));

  if (manquants.length === 0) {
    ok("⑬ gel d'adresse", "actions/tournois.ts", "la garde A3 est présente dans le source");
  } else {
    ko("⑬ gel d'adresse", "actions/tournois.ts", `absent(s) du source : ${manquants.join(" · ")}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// ⑭ AUCUNE PAGE PUBLIQUE NE SERT UN TOURNOI — LE SEUL BLOC QUI **COMMITE**
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 LE TÉMOIN DE L'ARBITRAGE **A6**, ET IL S'INVERSERA À LA STORY 9.2. Cette story n'ajoute
// AUCUNE page publique : ni `/tournois`, ni `/tournois/<slug>`. La garde vérifie donc que les
// **cinq** pages publiques existantes ne servent **aucun** tournoi — publié comme brouillon.
// ⚠️ **Le témoin publié est le plus important des deux** : sans lui, la garde serait
// tautologique (« un brouillon n'apparaît pas » est vrai même si le rendu est cassé). Un état
// « tout à zéro » ressemble à « tout va bien » — leçon 4.2, et elle exige au moins un cas dont
// l'attendu est NON NUL. Ici l'attendu non nul est en base : les deux lignes DOIVENT exister au
// moment de la mesure, et la garde le vérifie avant de conclure.
// 🔴 À LA STORY 9.2, CETTE GARDE DOIT ÊTRE **RETOURNÉE** : le témoin publié devra apparaître
// sur `/tournois`, et le brouillon devra rester absent. Ne pas la supprimer — la retourner.
{
  const slugPublie = `zz-gate-publie-${MARQUE.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const slugBrouillon = `zz-gate-brouillon-${MARQUE.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const nomPublie = `${MARQUE}-PUBLIE`;
  const nomBrouillon = `${MARQUE}-BROUILLON`;
  let idEvenement: string | null = null;

  try {
    const [evt] = await sql<{ id: string }[]>`
      insert into event (title, venue_name, starts_at, is_published)
      values (${MARQUE + "-evt"}, 'Salle temoin', now(), true)
      returning id`;
    idEvenement = evt.id;

    await sql`insert into tournament (event_id, name, game, slug, starts_at, registration_mode, is_published)
              values (${idEvenement}, ${nomPublie}, 'CS2', ${slugPublie}, now(), 'interne', true)`;
    await sql`insert into tournament (event_id, name, game, slug, starts_at, registration_mode, is_published)
              values (${idEvenement}, ${nomBrouillon}, 'CS2', ${slugBrouillon}, now(), 'interne', false)`;

    // Le cas de vérité connue, LU EN PREMIER (leçon 4.2, parade n°8) : si les deux lignes ne
    // sont pas là, la mesure qui suit ne dit rien du tout.
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from tournament where name like ${MARQUE + "%"}`;
    if (n !== 2) {
      ko("⑭ rien de public", "témoins", `${n} témoin(s) en base au lieu de 2 — la mesure ne dit rien`);
    } else {
      ok("⑭ rien de public", "témoins", "2 témoins en base (1 publié, 1 brouillon) — la mesure est décidable");

      // ⚠️ On balaie `PAGES` de la configuration, JAMAIS une liste en dur : un instrument qui
      // liste son périmètre à la main RÉTRÉCIT tout seul à mesure que le projet grandit
      // (défaut mesuré en 5.5 — une sonde prouvait « invisible » sur 3 pages et rien du tout
      // sur les 2 autres, en silence, pendant deux epics).
      for (const page of PAGES) {
        const r = await demander(page);
        // En autotest, on cherche une chaîne que la page contient forcément : la garde doit
        // alors crier.
        const cherches = AUTOTEST ? ["<html"] : [nomPublie, nomBrouillon, slugPublie, slugBrouillon];
        const vus = cherches.filter((c) => r.corps.includes(c));
        if (vus.length === 0) {
          ok("⑭ rien de public", page, "aucun tournoi servi (A6 : cette story n'ajoute aucune page publique)");
        } else {
          ko("⑭ rien de public", page, `sert un tournoi : ${vus.join(", ")}`);
        }
      }
    }
  } finally {
    // 🔴 DANS UN `finally` : le ménage doit avoir lieu même si la porte lève. C'est la seule
    // écriture réellement commitée de cette porte (voir l'en-tête, précaution ②).
    await sql`delete from tournament where name like ${MARQUE + "%"}`;
    if (idEvenement) await sql`delete from event where id = ${idEvenement}`;
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
  "L'APPARENCE des écrans de tournois (ton, rythme, hiérarchie, longueur du formulaire) — " +
    "c'est le gate visuel de Brice, et la passe 1 ne s'outille pas (rétro Epic 5).",
);
exemptions.add(
  "🔴 LE GEL DE L'ADRESSE À LA PUBLICATION (A3) N'EST PAS MESURÉ PAR SON EFFET. La garde ⑬ " +
    "LIT le source de `actions/tournois.ts` : la règle vit dans une Server Action, dont " +
    "l'effet exige une session Discord que cette porte n'a pas. Elle attrape une SUPPRESSION " +
    "du bloc, pas une réécriture qui le rendrait inopérant.",
);
exemptions.add(
  "🔴 QUE LE RATTACHEMENT SOIT LE BON. La base garantit qu'un tournoi A UN événement (A4) ; " +
    "elle ne peut rien contre un tournoi rattaché au MAUVAIS événement. C'est l'écran qui le " +
    "couvre, en affichant l'événement sur chaque ligne — et le gate visuel qui le voit.",
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
