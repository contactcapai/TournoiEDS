// @porte surface=sollicitations effet=base story=6.11
// 🔬 SURFACE « SOLLICITATIONS » — LA 17ᵉ PORTE (Story 6.11)
//
// Pourquoi une porte dédiée — ce que ni lint, ni typecheck, ni build, ni Lighthouse, ni les
// quatre contrôles de `gate`, ni les seize autres portes ne peuvent voir :
//
//   défaut possible                                              lint/build  gate  gate:admin  œil
//   l'e-mail ou le message d'un tiers sort dans le HTML sans session  ❌       ❌       ❌      ❌
//   l'écran de détail devient éditable (une demande se falsifie)      ❌       ❌       ❌      ⚠️
//   un export de l'action d'admin perd son `requireAdmin()`           ❌       ❌       ❌      ❌
//   l'ordre cesse d'être TOTAL (deux doublons de R31 scintillent)     ❌       ❌       ❌      ❌
//   un `CHECK` de la table diverge des bornes Zod du formulaire       ❌       ❌       ❌      ❌
//   la valeur de GMAIL_APP_PASSWORD part dans le HTML                 ❌       ❌       ❌      ❌
//   une colonne d'ordre manuel apparaît sur une table chronologique   ❌       ❌       ❌      ❌
//
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE QUE CETTE PORTE A DE PROPRE : SON OBJET EST UNE DONNÉE PERSONNELLE **DE TIERS**
// ══════════════════════════════════════════════════════════════════════════════════════
//
// `gate:membres` (6.10) gardait déjà de la donnée personnelle — mais des prénoms d'ADHÉRENTS,
// couverts par la clause des statuts. Ici ce sont le nom, l'adresse e-mail et le message libre
// de collectivités, d'écoles et d'entreprises qui n'ont aucun lien avec l'association et n'ont
// consenti qu'à **recevoir une réponse**. La garde ③ est donc la plus importante du fichier :
// elle insère un témoin dont l'e-mail et le message sont des chaînes uniques, puis interroge
// le **HTML SERVI** sans aucun cookie. On mesure un corps de réponse, pas un code de statut —
// leçon `gate:admin` (6.1) : le corps d'un `307` portait tout le tableau de bord.
//
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 DEUX GARDES LISENT LE **SOURCE**, ET C'EST ASSUMÉ (⑧ et ⑨)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// La doctrine du projet est de mesurer des EFFETS (`gate:links`). Mais l'effet des Server
// Actions d'admin exige une SESSION, que cette porte n'a pas — `gate:membres` déclare la même
// limite en exemption. Or deux propriétés de ce fichier-là valent d'être tenues :
//
//   · ⑧ **tout** export de `actions/sollicitations.ts` commence par `requireAdmin()` ;
//   · ⑨ l'action de bascule n'écrit **que** `isProcessed`.
//
// Les lire est le seul témoin disponible, et c'est le même raisonnement que la leçon la plus
// chère de l'Epic 6 (6.9) : quand l'écriture est aveugle, on LIT. La limite est déclarée en
// sortie — un `requireAdmin()` présent ne prouve pas qu'il est atteint, c'est le gate visuel
// qui l'exerce.
//
// 🔴 CETTE PORTE ÉCRIT EN BASE (4ᵉ dans ce cas, après `gate:solicitation`, `gate:agenda` et
// `gate:galerie`). Toutes ses lignes portent `MARQUEUR` dans `name` et sont supprimées en
// `finally` — le décompte final le VÉRIFIE. Aucun fichier, aucun volume : une sollicitation
// n'a pas de média.
//
// Usage :  pnpm --filter vitrine gate:sollicitations [baseUrl]
//          SOLLICITATIONS_AUTOTEST=1 …  → auto-validation de l'instrument
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

import { BASE as BASE_DEFAUT } from "./config.mjs";
import { lireVariable } from "./env.mjs";
import { solicitationInputSchema } from "../../src/lib/schemas/solicitation";
import { cleanText } from "../../src/lib/text";
import { SOLLICITATIONS_MAX } from "../../src/server/db/queries/solicitations";

const BASE = process.argv[2] ?? BASE_DEFAUT;
const AUTOTEST = process.env.SOLLICITATIONS_AUTOTEST === "1";

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

const lireSource = (chemin: string) => readFileSync(join(RACINE_APP, chemin), "utf8");

console.log(`\n🔎 Surface « sollicitations » — ${BASE}`);
if (AUTOTEST) {
  console.log("   MODE AUTO-VALIDATION : on présente à chaque garde un cas qu'elle doit voir.");
}

// ══════════════════════════════════════════════════════════════════════════════════════
// MOITIÉ A — HTTP NU, SANS AUCUN COOKIE
// ══════════════════════════════════════════════════════════════════════════════════════

/** Un UUID valide, mais qui ne désigne rien : la garde porte sur la ROUTE, pas sur la donnée. */
const UUID_QUELCONQUE = "00000000-0000-4000-8000-000000000000";

const ROUTES = [
  "/admin/sollicitations",
  `/admin/sollicitations/${UUID_QUELCONQUE}`,
];

// En autotest, on présente une route qu'on SAIT ouverte comme si elle devait être protégée.
// Si les gardes sont réelles, elles échouent. Si elles restent vertes, l'instrument ne mesure
// rien et il ne faut pas se fier à ses verdicts.
const ROUTES_EPROUVEES = AUTOTEST ? ["/admin/login"] : ROUTES;

/** Marqueurs de CONTENU d'administration — jamais un titre.
 *  ⚠️ Leçon de `gate:admin`, reprise telle quelle : un marqueur pris sur un `<title>` rendrait
 *  la porte rouge sur une redirection parfaitement propre (Next évalue les `metadata` même
 *  quand le rendu s'interrompt). */
const MARQUEURS_ADMIN = [
  "Se déconnecter",
  "Lire la demande",
  "Marquer traitée",
  "Retour aux sollicitations",
  "sollicitations-module__",
];

for (const route of ROUTES_EPROUVEES) {
  const r = await demander(route);
  if (estRedirection(r.statut) && versLogin(r.emplacement)) {
    ok("①", route, `${r.statut} → ${r.emplacement}`);
  } else {
    ko("①", route, `attendu une redirection vers /admin/login, reçu ${r.statut}`);
  }

  const fuite = MARQUEURS_ADMIN.filter((m) => r.corps.includes(m));
  if (fuite.length === 0) ok("②", route, "aucun marqueur d'administration dans le corps servi");
  else ko("②", route, `le corps servi contient ${fuite.map((f) => `« ${f} »`).join(", ")}`);
}

// ══════════════════════════════════════════════════════════════════════════════════════
// BASE DE DÉVELOPPEMENT
// ══════════════════════════════════════════════════════════════════════════════════════


const urlBase = lireVariable("DATABASE_URL");
if (!urlBase) {
  console.log("🔴 DATABASE_URL introuvable — la moitié B ne peut pas s'exécuter.");
  process.exit(1);
}

// ⚠️ `max: 1` ET aucune requête externe à l'intérieur d'un `sql.begin` : `gate:partenaires`
// (6.5) puis `gate:membres` (6.10) se sont BLOQUÉES — pas « échouées », bloquées, sans rendre
// AUCUN verdict — parce qu'une connexion externe était utilisée sur un pool de 1.
const sql = postgres(urlBase, { max: 1, onnotice: () => {} });

const MARQUEUR = "GATE AUTOTEST sollicitations-check";
const avantMenage = Number((await sql`select count(*)::int as n from solicitation`)[0].n);

// 🔴 TOUT CE QUI SUIT EST DANS UN `try/finally` : les lignes de cette porte ne doivent JAMAIS
// survivre à son exécution, y compris quand une garde lève.
let apresMenage = -1;
try {
  // ── ③ 🔴 AUCUNE DONNÉE PERSONNELLE DANS LE HTML SERVI SANS SESSION ───────────────────
  // On insère un témoin dont l'e-mail ET le message sont des chaînes qu'on ne peut pas
  // trouver ailleurs, puis on demande les deux routes SANS COOKIE. Si l'une d'elles laisse
  // filtrer l'une de ces chaînes, la garde tombe.
  const EMAIL_TEMOIN = "zz-temoin-sollicitation-6-11@exemple-gate.test";
  const MESSAGE_TEMOIN = "ZzMessageTemoinSollicitation611NeDoitJamaisSortirSansSession";

  const [temoin] = await sql<{ id: string }[]>`
    insert into solicitation (name, email, request_type, message, consent_given)
    values (${MARQUEUR + " ③"}, ${EMAIL_TEMOIN}, 'animation', ${MESSAGE_TEMOIN}, true)
    returning id
  `;

  // En autotest, on cherche une chaîne qui EST réellement servie par la page de connexion :
  // la garde doit alors tomber. Sinon elle ne cherche rien.
  const AIGUILLES = AUTOTEST ? ["Esport des Sacres"] : [EMAIL_TEMOIN, MESSAGE_TEMOIN];
  const ROUTES_FUITE = AUTOTEST
    ? ["/admin/login"]
    : ["/admin/sollicitations", `/admin/sollicitations/${temoin.id}`];

  for (const route of ROUTES_FUITE) {
    const r = await demander(route);
    const trouvees = AIGUILLES.filter((a) => r.corps.includes(a));
    if (trouvees.length === 0) {
      ok("③", route, "ni l'e-mail ni le message du témoin dans le corps servi sans session");
    } else {
      ko("③", route, `DONNÉE PERSONNELLE SERVIE SANS SESSION : ${trouvees.join(", ")}`);
    }
  }

  // ── ④ LES QUATRE `CHECK` REFUSENT CE QUE ZOD REFUSE ──────────────────────────────────
  // 🔴 La base est le garde-fou qu'on ne peut PAS contourner par un `UPDATE` direct, une
  // restauration ou un script de migration. Cette table est écrite par une requête PUBLIQUE
  // NON AUTHENTIFIÉE : c'est la seule du projet dans ce cas.
  type Ecriture = { quoi: string; jouer: (t: postgres.TransactionSql) => Promise<unknown> };

  const ECRITURES_INTERDITES: Ecriture[] = [
    {
      quoi: "un nom vide",
      jouer: (t) => t`insert into solicitation (name, email, request_type, message, consent_given)
        values ('   ', 'a@b.fr', 'animation', 'msg', true)`,
    },
    {
      quoi: "un nom de 121 caractères",
      jouer: (t) => t`insert into solicitation (name, email, request_type, message, consent_given)
        values (${"x".repeat(121)}, 'a@b.fr', 'animation', 'msg', true)`,
    },
    {
      quoi: "un e-mail sans arobase",
      jouer: (t) => t`insert into solicitation (name, email, request_type, message, consent_given)
        values (${MARQUEUR}, 'pas-un-email', 'animation', 'msg', true)`,
    },
    {
      quoi: "un message vide",
      jouer: (t) => t`insert into solicitation (name, email, request_type, message, consent_given)
        values (${MARQUEUR}, 'a@b.fr', 'animation', '  ', true)`,
    },
    {
      quoi: "🔴 un consentement ABSENT (la garde RGPD la plus importante de la table)",
      jouer: (t) => t`insert into solicitation (name, email, request_type, message, consent_given)
        values (${MARQUEUR}, 'a@b.fr', 'animation', 'msg', false)`,
    },
  ];

  for (const ecriture of ECRITURES_INTERDITES) {
    // ⚠️ En autotest, on remplace l'écriture par une écriture VALIDE : la garde doit alors
    // échouer, puisqu'elle attend un refus.
    let refusee = false;
    try {
      await sql.begin(async (t) => {
        if (AUTOTEST) {
          await t`insert into solicitation (name, email, request_type, message, consent_given)
            values (${MARQUEUR}, 'valide@exemple.fr', 'animation', 'message valide', true)`;
        } else {
          await ecriture.jouer(t);
        }
        // On annule TOUJOURS : cette porte ne laisse rien derrière elle.
        throw new Error("ROLLBACK_VOULU");
      });
    } catch (erreur) {
      const message = String((erreur as { message?: string }).message ?? erreur);
      refusee = !message.includes("ROLLBACK_VOULU");
    }
    if (refusee) ok("④", "base", `refuse ${ecriture.quoi}`);
    else ko("④", "base", `ACCEPTE ${ecriture.quoi} — le CHECK ne tient pas`);
  }

  // ── ⑤ CONTRE-ÉPREUVE : une écriture VALIDE passe ─────────────────────────────────────
  // Sans elle, une porte qui refuserait TOUT paraîtrait verte sur ④.
  {
    let acceptee = false;
    try {
      await sql.begin(async (t) => {
        await t`insert into solicitation (name, email, request_type, message, consent_given)
          values (${MARQUEUR}, ${AUTOTEST ? "pas-un-email" : "valide@exemple.fr"},
                  'animation', 'message valide', true)`;
        acceptee = true;
        throw new Error("ROLLBACK_VOULU");
      });
    } catch {
      /* rollback voulu */
    }
    if (acceptee) ok("⑤", "base", "accepte une demande valide (contre-épreuve de ④)");
    else ko("⑤", "base", "REFUSE une demande valide — les CHECK sont trop stricts");
  }

  // ── ⑥ 🔴 PARITÉ BASE ↔ ZOD, LUE DANS LE **TEXTE** DE LA CONTRAINTE ───────────────────
  // Leçon la plus chère de l'Epic 6 (6.9) : `event_has_venue` a survécu à trois epics parce
  // qu'on la testait PAR UNE ÉCRITURE. Ici les quatre colonnes sont `NOT NULL`, donc
  // l'écriture n'est pas aveugle — mais le témoin juste reste la LECTURE, et c'est lui qui
  // resterait juste si une colonne devenait nullable un jour.
  const contraintes = await sql<{ conname: string; definition: string }[]>`
    select conname, pg_get_constraintdef(oid) as definition
    from pg_constraint
    where conrelid = 'solicitation'::regclass and contype = 'c'
  `;
  const parContrainte = new Map(contraintes.map((c) => [c.conname, c.definition]));

  const ATTENDUES: { nom: string; doitContenir: string[] }[] = [
    { nom: "solicitation_name_valide", doitContenir: ["btrim", "<= 120"] },
    { nom: "solicitation_email_valide", doitContenir: ["btrim", "@", "<= 254"] },
    { nom: "solicitation_message_valide", doitContenir: ["btrim", "<= 5000"] },
    { nom: "solicitation_consent_given", doitContenir: ["consent_given = true"] },
  ];

  for (const attendue of ATTENDUES) {
    const definition = parContrainte.get(attendue.nom);
    // En autotest, on exige une chaîne qui n'y est pas : la garde doit alors échouer.
    const cherchees = AUTOTEST ? ["CETTE_CHAINE_N_EXISTE_PAS"] : attendue.doitContenir;
    if (!definition) {
      ko("⑥", attendue.nom, "CONTRAINTE ABSENTE de la table");
      continue;
    }
    const manquantes = cherchees.filter((c) => !definition.includes(c));
    if (manquantes.length === 0) {
      ok("⑥", attendue.nom, `texte conforme (${definition})`);
    } else {
      ko("⑥", attendue.nom, `le texte ne contient pas ${manquantes.join(", ")} — ${definition}`);
    }
  }

  // Parité côté Zod : les MÊMES bornes, éprouvées sur le schéma partagé avec le formulaire.
  {
    const base = {
      email: "a@b.fr",
      requestType: "animation" as const,
      message: "message valide",
      consentGiven: true,
    };
    const cas: { quoi: string; entree: unknown; doitPasser: boolean }[] = [
      { quoi: "nom de 120", entree: { ...base, name: "x".repeat(120) }, doitPasser: true },
      { quoi: "nom de 121", entree: { ...base, name: "x".repeat(121) }, doitPasser: false },
      {
        quoi: "message de 5001",
        entree: { ...base, name: "ok", message: "x".repeat(5001) },
        doitPasser: false,
      },
      // ⚠️ 250 + « @b.fr » = 255 caractères, soit UN de plus que la borne. Écrit ainsi et non
      // « repeat(255) » : un premier jet à `repeat(247)` faisait 252 caractères — donc SOUS la
      // borne — et la garde a accusé Zod de laisser passer un cas qu'il devait justement
      // accepter. La longueur d'un cas de borne se CALCULE, elle ne s'estime pas.
      {
        quoi: "e-mail de 255",
        entree: { ...base, name: "ok", email: "x".repeat(250) + "@b.fr" },
        doitPasser: false,
      },
      {
        quoi: "consentement à false",
        entree: { ...base, name: "ok", consentGiven: false },
        doitPasser: false,
      },
    ];
    for (const c of cas) {
      const passe = solicitationInputSchema.safeParse(c.entree).success;
      const attendu = AUTOTEST ? !c.doitPasser : c.doitPasser;
      if (passe === attendu) ok("⑥b", "zod", `${c.quoi} — ${passe ? "accepté" : "refusé"}`);
      else ko("⑥b", "zod", `${c.quoi} : attendu ${attendu ? "accepté" : "refusé"}, obtenu l'inverse`);
    }
  }

  // ── ⑦ 🔴 L'ORDRE EST **TOTAL** — ET C'EST LA DETTE R31 QUI L'EXIGE ───────────────────
  // Le bouton du formulaire public n'est jamais désactivé et l'action n'a aucune clé
  // d'idempotence : un double-clic écrit deux lignes AU MÊME `created_at`. Sans `id` en
  // second terme, Postgres ne garantit alors PAS l'ordre — les deux doublons de R31
  // scintilleraient sur l'écran même dont le travail est de les distinguer.
  // On fabrique exactement ce cas : deux lignes, un seul instant.
  {
    const INSTANT = new Date("2026-01-02T03:04:05.000Z");
    await sql`
      insert into solicitation (name, email, request_type, message, consent_given, created_at)
      values (${MARQUEUR + " ⑦a"}, 'a@b.fr', 'animation', 'doublon a', true, ${INSTANT}),
             (${MARQUEUR + " ⑦b"}, 'a@b.fr', 'animation', 'doublon b', true, ${INSTANT})
    `;

    const lire = async () =>
      (
        await sql<{ id: string }[]>`
          select id from solicitation
          where name like ${MARQUEUR + " ⑦%"}
          order by created_at desc, id desc
        `
      ).map((l) => l.id);

    const premier = await lire();
    const second = await lire();

    // ⚠️ Deux exécutions identiques ne prouvent que le déterminisme. On vérifie EN PLUS que
    // l'ordre obtenu est bien celui d'`id DESC` — sinon un tri stable mais faux passerait.
    const attenduParId = [...premier].sort().reverse();
    const identiques = premier.join() === second.join();
    const conforme = premier.join() === attenduParId.join();

    // En autotest on compare à l'ordre INVERSE : la garde doit alors tomber.
    const verdict = AUTOTEST ? identiques && premier.join() === [...attenduParId].reverse().join()
                             : identiques && conforme;
    if (verdict) {
      ok("⑦", "ordre", "deux lignes au MÊME created_at sortent dans un ordre stable et total");
    } else {
      ko(
        "⑦",
        "ordre",
        identiques
          ? "l'ordre est stable mais ne suit pas `id DESC` — le second terme ne tranche pas"
          : "DEUX LECTURES IDENTIQUES ONT RENDU DES ORDRES DIFFÉRENTS — l'ordre n'est pas total",
      );
    }
  }

  // ── ⑧ 🔴 TOUT EXPORT DE L'ACTION D'ADMIN COMMENCE PAR `requireAdmin()` ───────────────
  // Lecture de source ASSUMÉE (voir l'en-tête) : l'effet exige une session. Ce que cette
  // garde ferme, c'est le jour où quelqu'un ajoutera un 3ᵉ export en oubliant la ligne — que
  // ni lint, ni typecheck, ni build ne verront.
  {
    const source = lireSource("src/server/actions/sollicitations.ts");
    const corps = source.split("export async function ").slice(1);
    const sansGarde = corps
      .map((bloc) => {
        const nom = bloc.slice(0, bloc.indexOf("("));
        // Les ~12 premières lignes du corps : la garde doit y être, en première instruction.
        const debut = bloc.split("\n").slice(0, 12).join("\n");
        return debut.includes("await requireAdmin()") ? null : nom;
      })
      .filter((n): n is string => n !== null);

    // En autotest, on éprouve le fichier PUBLIC, qui n'a délibérément aucune garde de session :
    // la garde doit alors tomber.
    const sourceEprouvee = AUTOTEST
      ? lireSource("src/server/actions/solicitation.ts")
      : source;
    const corpsEprouves = sourceEprouvee.split("export async function ").slice(1);
    const manquants = AUTOTEST
      ? corpsEprouves
          .map((b) => {
            const nom = b.slice(0, b.indexOf("("));
            return b.split("\n").slice(0, 12).join("\n").includes("await requireAdmin()")
              ? null
              : nom;
          })
          .filter((n): n is string => n !== null)
      : sansGarde;

    if (corpsEprouves.length === 0) {
      ko("⑧", "actions", "AUCUN export trouvé — la garde ne mesure rien, l'instrument est faux");
    } else if (manquants.length === 0) {
      ok("⑧", "actions", `${corpsEprouves.length} export(s), tous ouverts par requireAdmin()`);
    } else {
      ko("⑧", "actions", `export(s) SANS requireAdmin() : ${manquants.join(", ")}`);
    }
  }

  // ── ⑨ 🔴 LA BASCULE N'ÉCRIT **QUE** `isProcessed` ────────────────────────────────────
  // Le nom, l'e-mail, le type et le message ont été saisis par un VISITEUR : les rendre
  // modifiables serait falsifier une demande reçue. Lecture de source, même motif que ⑧.
  {
    const source = lireSource("src/server/actions/sollicitations.ts");
    const sets = [...source.matchAll(/\.set\(\{([^}]*)\}\)/g)].map((m) => m[1]);
    const COLONNES_INTERDITES = ["name", "email", "requestType", "message", "consentGiven"];
    const fautives = sets.flatMap((bloc) =>
      COLONNES_INTERDITES.filter((c) => new RegExp(`\\b${c}\\s*:`).test(bloc)),
    );
    // En autotest, on cherche `isProcessed` lui-même : il EST là, donc la garde doit tomber.
    const cherchees = AUTOTEST
      ? sets.flatMap((bloc) => (/\bisProcessed\s*:/.test(bloc) ? ["isProcessed"] : []))
      : fautives;

    if (sets.length === 0) {
      ko("⑨", "actions", "aucun `.set({…})` trouvé — la garde ne mesure rien");
    } else if (cherchees.length === 0) {
      ok("⑨", "actions", `${sets.length} écriture(s), aucune colonne de contenu modifiée`);
    } else {
      ko("⑨", "actions", `une écriture touche ${[...new Set(cherchees)].join(", ")}`);
    }
  }

  // ── ⑩ L'INDEX POUR LEQUEL LA REQUÊTE A ÉTÉ ÉCRITE EXISTE ─────────────────────────────
  // Posé par la migration `0004` (Story 5.1) AVANT son écran, avec le commentaire qui
  // l'annonce. Le perdre ne casserait rien de visible — seulement la performance de la seule
  // table du site qui ne fait que croître.
  {
    const index = await sql<{ indexname: string }[]>`
      select indexname from pg_indexes where tablename = 'solicitation'
    `;
    const attendu = AUTOTEST ? "index_qui_n_existe_pas" : "solicitation_processed_created_at_idx";
    if (index.some((i) => i.indexname === attendu)) {
      ok("⑩", "base", `${attendu} présent`);
    } else {
      ko("⑩", "base", `${attendu} ABSENT (présents : ${index.map((i) => i.indexname).join(", ")})`);
    }
  }

  // ── ⑪ 🔴 AUCUNE COLONNE D'ORDRE MANUEL — L'ABSENCE EST LE LIVRABLE ───────────────────
  // Les cinq autres surfaces ont un `sort_order` et des flèches monter/descendre. Ici l'ordre
  // est CHRONOLOGIQUE : il appartient aux faits, pas au bénévole. Une colonne d'ordre
  // apparaîtrait « par symétrie » sans que rien ne la refuse — sauf cette garde.
  {
    const colonnes = await sql<{ column_name: string }[]>`
      select column_name from information_schema.columns
      where table_name = 'solicitation'
    `;
    const noms = colonnes.map((c) => c.column_name);
    const interdites = AUTOTEST ? ["created_at"] : ["sort_order", "position", "rang"];
    const trouvees = interdites.filter((i) => noms.includes(i));
    if (trouvees.length === 0) {
      ok("⑪", "schéma", `aucune colonne d'ordre manuel (${noms.length} colonnes)`);
    } else {
      ko("⑪", "schéma", `colonne d'ordre manuel : ${trouvees.join(", ")}`);
    }
  }

  // ── ⑫ AUCUNE ROUTE `apercu/`, ET LA SECTION NE PROMET AUCUN RENDU ────────────────────
  // Une sollicitation ne se publie pas. Promettre « Voir le rendu avant de publier » serait
  // une porte sans pièce — le défaut que `_sections.ts` existe pour empêcher, et qui s'est
  // produit DEUX fois sur ce projet.
  {
    // 🔴 ON RETIRE LES COMMENTAIRES AVANT DE CHERCHER — DÉFAUT D'INSTRUMENT PAYÉ ICI MÊME.
    // Le premier jet lisait le bloc brut : le commentaire qui explique *pourquoi* cette
    // description ne finit PAS par « Voir le rendu » contient forcément ces mots, et la garde
    // a donc accusé une entrée parfaitement juste. La croire aurait fait supprimer le
    // commentaire qui porte la règle. Même classe que le balayage de classes fantômes de la
    // 6.10, qui lisait les commentaires du TSX (5 faux positifs sur des stories mergées).
    const sansCommentaires = lireSource("src/app/admin/_sections.ts")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    const entree = sansCommentaires.slice(sansCommentaires.indexOf('"/admin/sollicitations"'));
    const bloc = entree.slice(0, entree.indexOf("},"));
    const promet = AUTOTEST ? bloc.includes("Sollicitations") : bloc.includes("Voir le rendu");
    if (!promet) ok("⑫", "_sections", "la description ne promet aucun rendu public");
    else ko("⑫", "_sections", "la description promet « Voir le rendu » : porte sans pièce");

    // 🔴 ET L'ABSENCE DE ROUTE `apercu/` SE LIT SUR LE DISQUE, PAS EN HTTP — 2ᵉ défaut
    // d'instrument payé ici. Le premier jet demandait `/admin/sollicitations/apercu` et
    // attendait un 404 : or le matcher `/admin/:path*` du proxy **redirige AVANT tout
    // routage**, il ne discrimine RIEN (fait déjà mesuré au gate visuel de la 6.10, où les
    // deux ports rendaient 307). Un 307 ne prouve donc ni l'existence ni l'absence.
    // ⚠️ Et « apercu » serait de toute façon capté par le segment `[id]`.
    const dossier = "src/app/admin/(protege)/sollicitations";
    const cible = AUTOTEST ? "src/app/admin/(protege)/membres" : dossier;
    const aUnApercu = existsSync(join(RACINE_APP, cible, "apercu"));
    if (!aUnApercu) ok("⑫b", dossier, "aucune route `apercu/` — rien à prévisualiser");
    else ko("⑫b", cible, "une route `apercu/` existe : porte sans pièce");
  }

  // ── ⑬ 🔴 LA VALEUR DE `GMAIL_APP_PASSWORD` NE PART JAMAIS DANS LE HTML ───────────────
  // L'écran DIT que les notifications ne partent pas — mais il le MESURE sur l'environnement
  // (dette R32), il ne l'écrit pas en dur. Le risque du montage est de rendre la variable
  // elle-même au lieu du booléen dérivé.
  {
    const source = lireSource("src/app/admin/(protege)/sollicitations/page.tsx");
    // 🔴 `?.trim()` EXIGÉ — trouvé en revue (Edge Case Hunter). Sans lui, `Boolean("   ")`
    // vaut `true` : la mention DISPARAÎT alors que `client.ts` (`if (!pass)`) ne lève pas non
    // plus sur cette valeur et tente un envoi voué à l'échec. Le seul avertissement du
    // système s'éteignait exactement dans le cas où il fallait le lire. La garde exige donc
    // la forme trimée, pas seulement « un booléen dérivé ».
    const derive = /Boolean\(process\.env\.GMAIL_APP_PASSWORD\?\.trim\(\)\)/.test(source);
    // Interpolation directe dans du JSX : `{process.env.GMAIL_APP_PASSWORD}` ou concaténation.
    const fuite = /\{\s*process\.env\.GMAIL_APP_PASSWORD\s*\}/.test(source);
    const verdict = AUTOTEST ? !derive || fuite : derive && !fuite;
    if (verdict) ok("⑬", "R32", "mention dérivée d'un booléen TRIMÉ, valeur jamais rendue");
    else if (!derive) ko("⑬", "R32", "la mention n'est pas dérivée d'un `?.trim()` de l'environnement");
    else ko("⑬", "R32", "la VALEUR de GMAIL_APP_PASSWORD est interpolée dans le rendu");
  }

  // ── ⑮ 🔴 LE `mailto:` EST CONSTRUIT SUR UNE ADRESSE RE-VALIDÉE ───────────────────────
  // Trouvé en revue (Edge Case Hunter) : le `CHECK solicitation_email_valide` n'exige qu'un
  // `@` et une longueur. Une valeur écrite par un chemin qui contourne Zod peut valoir
  // `@@@@@@`, passer la base, et produire un `href="mailto:@@@@@@"` — une ANCRE MORTE, très
  // exactement ce que la Story 5.5 a supprimé du site.
  // ⚠️ Lecture de source, même motif assumé que ⑧ et ⑨ : le rendu du détail exige une session.
  {
    const source = lireSource("src/app/admin/(protege)/sollicitations/[id]/page.tsx");
    const revalide = /z\.email\(\)\.safeParse\(/.test(source);
    // Le `href` doit être construit sur la variable re-validée, pas sur l'adresse brute.
    const surLaBonneVariable = /mailto:\$\{encodeURIComponent\(emailUtilisable\)/.test(source);
    // En autotest, on exige la forme d'AVANT le correctif : la garde doit alors tomber.
    const verdict = AUTOTEST
      ? /mailto:\$\{encodeURIComponent\(email\)/.test(source)
      : revalide && surLaBonneVariable;
    if (verdict) ok("⑮", "mailto", "adresse re-validée par `z.email()` avant de construire le lien");
    else if (!revalide) ko("⑮", "mailto", "aucune re-validation de forme : ancre morte possible");
    else ko("⑮", "mailto", "le `href` n'est pas construit sur l'adresse re-validée");
  }

  // ── ⑭ LA BORNE EST PARTAGÉE, PAS RECOPIÉE ───────────────────────────────────────────
  // Défaut trouvé en revue de la 6.10 : `MEMBRES_MAX` vivait en local dans la page tandis que
  // l'action lisait sans borne. Deux bornes qui doivent être égales ne se recopient pas.
  {
    const page = lireSource("src/app/admin/(protege)/sollicitations/page.tsx");
    const importe = page.includes("SOLLICITATIONS_MAX");
    const litteral = AUTOTEST
      ? true
      : new RegExp(`\\b${SOLLICITATIONS_MAX}\\b`).test(page.replace(/SOLLICITATIONS_MAX/g, ""));
    if (importe && !litteral) {
      ok("⑭", "borne", `SOLLICITATIONS_MAX (${SOLLICITATIONS_MAX}) importée, aucun littéral`);
    } else if (!importe) {
      ko("⑭", "borne", "la page n'importe pas SOLLICITATIONS_MAX");
    } else {
      ko("⑭", "borne", `la page contient le littéral ${SOLLICITATIONS_MAX} en plus de la constante`);
    }
  }
  // ── ⑯ 🔴 `cleanText` NEUTRALISE LES CARACTÈRES SANS LARGEUR, ET LA RÈGLE EST UNIQUE ──
  // Trouvé en revue par DEUX agents indépendamment (Blind Hunter + Edge Case Hunter), et pire
  // que ce qu'ils décrivaient : `WorkshopCatalog.tsx` (Story 6.9, page publique `/animations`)
  // AFFIRMAIT en commentaire que `cleanText` ramenait les chaînes invisibles à `null`, ce qui
  // était FAUX — un document d'autorité prescrivant un invariant absent.
  // ⚠️ Cette garde vit ici parce que c'est cette story qui a corrigé la source. Elle protège
  // les 13 consommateurs, pas seulement les deux écrans de sollicitations.
  {
    const ZW = String.fromCharCode(0x200b);
    const cas: { quoi: string; entree: string; doitEtreNull: boolean }[] = [
      { quoi: "5 × U+200B", entree: ZW.repeat(5), doitEtreNull: true },
      { quoi: "U+FEFF + U+200B", entree: String.fromCharCode(0xfeff) + ZW, doitEtreNull: true },
      { quoi: "trait d'union conditionnel seul", entree: String.fromCharCode(0x00ad), doitEtreNull: true },
      { quoi: "espaces", entree: "   ", doitEtreNull: true },
      { quoi: "texte normal", entree: "Mairie de Reims", doitEtreNull: false },
      // 🔴 CONTRE-ÉPREUVE INDISPENSABLE : ZWJ (U+200D) porte du SENS dans les séquences
      // d'emoji et dans plusieurs écritures. Une garde qui ne l'éprouverait pas laisserait
      // passer un durcissement qui corromprait des valeurs légitimes.
      {
        quoi: "emoji à ZWJ (doit SURVIVRE)",
        entree: String.fromCodePoint(0x1f468) + String.fromCharCode(0x200d) + String.fromCodePoint(0x1f4bb),
        doitEtreNull: false,
      },
    ];
    const echoues = cas.filter((c) => {
      const rendu = cleanText(c.entree) === null;
      return AUTOTEST ? rendu === c.doitEtreNull : rendu !== c.doitEtreNull;
    });
    if (echoues.length === 0) {
      ok("⑯", "cleanText", `${cas.length} cas — invisibles neutralisés, ZWJ préservé`);
    } else {
      ko("⑯", "cleanText", `cas non conformes : ${echoues.map((c) => c.quoi).join(", ")}`);
    }

    // La règle ne doit exister qu'UNE fois. Deux copies divergeraient en silence entre
    // l'écriture (Zod) et le rendu (`cleanText`) — c'est exactement la dette R37.
    const definitions = ["src/lib/text.ts", "src/lib/schemas/texte.ts"].filter((f) =>
      /SANS_LARGEUR\s*=/.test(lireSource(f)),
    );
    const attendu = AUTOTEST ? 2 : 1;
    if (definitions.length === attendu) {
      ok("⑯b", "règle unique", `1 définition de la classe sans-largeur (${definitions[0]})`);
    } else {
      ko("⑯b", "règle unique", `${definitions.length} définition(s) : ${definitions.join(", ")}`);
    }
  }
} finally {
  // ══════════════════════════════════════════════════════════════════════════════════════
  // MÉNAGE — TOUJOURS, MÊME SI UNE GARDE A LEVÉ
  // ══════════════════════════════════════════════════════════════════════════════════════
  await sql`delete from solicitation where name like ${MARQUEUR + "%"}`;
  apresMenage = Number((await sql`select count(*)::int as n from solicitation`)[0].n);
  await sql.end();
}

exemptions.add(
  "L'EFFET des Server Actions (bascule et suppression réellement exécutées, message d'erreur " +
    "rendu au bénévole, retour à la liste après suppression). Elles exigent une session, que " +
    "cette porte n'a pas : les gardes ⑧ et ⑨ LISENT le source, elles ne l'exercent pas. " +
    "L'exercice appartient au gate visuel.",
);
exemptions.add(
  "Que la mention de borne s'affiche VRAIMENT au-delà de " +
    SOLLICITATIONS_MAX +
    " demandes : le cas exige de peupler la table à ce volume, ce qu'on ne fait pas sur la " +
    "base de développement. La garde ⑭ tient la constante partagée, pas son rendu.",
);
exemptions.add(
  "Le RENDU : lisibilité du message long, ton des états vides, hiérarchie des deux sections. " +
    "C'est la passe 1 du gate visuel, et elle ne s'outille pas (rétro Epic 5).",
);
exemptions.add(
  "Le DÉBORDEMENT du message et de l'adresse (saisie libre, jusqu'à 5000 et 254 caractères) : " +
    "il est gardé par le 4ᵉ contrôle de `gate`… sur les PAGES PUBLIQUES uniquement. " +
    "`/admin/*` n'est pas dans `GATE_PAGES` — c'est le gate visuel qui l'exerce, sur le cas " +
    "du mot insécable de 80 caractères.",
);
exemptions.add(
  "Que chaque page d'admin appelle bien sa PROPRE garde : sans cookie le proxy redirige AVANT " +
    "que la page ne s'exécute, la fuite est structurellement inobservable ici (exemption " +
    "héritée de `gate:admin`).",
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
console.log(`  🧹 table solicitation : ${avantMenage} → ${apresMenage} ligne(s) après ménage.`);
if (apresMenage !== avantMenage) {
  console.log("  🔴 LA PORTE A LAISSÉ DES LIGNES DERRIÈRE ELLE — ne pas se fier à son verdict.");
  process.exit(1);
}

if (AUTOTEST) {
  if (echecs.length === 0) {
    console.log("\n🔴 AUTO-VALIDATION ÉCHOUÉE — chaque garde a reçu un cas qu'elle devait voir,");
    console.log("   et la porte reste verte. L'instrument ne mesure rien : ne pas s'y fier.");
    process.exit(1);
  }
  console.log(`\n✅ INSTRUMENT VALIDE — ${echecs.length} garde(s) ont vu le cas qu'on leur présentait.`);
  // 🔴 ET CE QUE L'AUTOTEST NE PROUVE PAS EST DIT ICI. Une auto-validation muette sur sa
  // propre couverture laisse croire que TOUTES les gardes sont éprouvées — c'est la forme la
  // plus discrète de `pieges/instrument-non-valide.md`.
  console.log("\n   ⚠️  DEUX GARDES N'ONT PAS DE CAS D'AUTO-VALIDATION, et ce n'est pas un oubli :");
  console.log("      · ② pas de fuite de marqueurs — la route témoin (/admin/login) ne PORTE");
  console.log("        aucun marqueur d'administration : lui en présenter un demanderait d'en");
  console.log("        fabriquer un faux, donc de valider une chaîne inventée plutôt que la garde.");
  console.log("      · ⑤ contre-épreuve — elle EST déjà l'inverse de ④ ; l'inverser à son tour");
  console.log("        reviendrait à ré-exécuter ④.");
  console.log("      ⇒ Leur verdict vert repose sur leur lecture, pas sur une mesure d'échec.");
  process.exit(0);
}

if (echecs.length > 0) {
  console.log(`\n🔴 ${echecs.length} GARDE(S) EN ÉCHEC.`);
  process.exit(1);
}
console.log(`\n✅ ${succes.length} GARDE(S) VERTE(S).`);
process.exit(0);
