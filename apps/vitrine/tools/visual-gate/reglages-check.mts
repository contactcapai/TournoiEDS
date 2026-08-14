// 🔬 SURFACE « RÉGLAGES » — LA 18ᵉ PORTE (Story 6.13)
//
// Pourquoi une porte dédiée — ce que ni lint, ni typecheck, ni build, ni Lighthouse, ni les
// quatre contrôles de `gate`, ni les dix-sept autres portes ne peuvent voir :
//
//   défaut possible                                                lint/build  gate  gate:links  œil
//   un CHECK nullable vaut NULL, donc PASSE (5 occasions ici)          ❌       ❌       ❌      ❌
//   une 2ᵉ ligne apparaît dans une table « à ligne unique »            ❌       ❌       ❌      ❌
//   une valeur saisie n'atteint PAS le chrome des 5 pages              ❌       ❌       ❌      ⚠️
//   une valeur VIDÉE laisse un lien mort derrière elle (R2)            ❌       ❌       ⚠️      ❌
//   la ligne disparaît et le site rend une 500 au lieu d'un repli      ❌       ❌       ❌      ⚠️
//   l'e-mail SAISI devient l'identité SMTP → envoi cassé EN SILENCE    ❌       ❌       ❌      ❌
//   un export de l'action d'admin perd son `requireAdmin()`            ❌       ❌       ❌      ❌
//   une colonne de texte libre apparaît dans `site_setting`            ❌       ❌       ❌      ❌
//   un mot souligné ne clique pas (R33 ③) — AU REPOS, pas au survol    ❌       ❌       ❌      ⚠️
//   une URL `HTTPS://x.fr` passe Zod puis est classée INTERNE          ❌       ❌       ❌      ❌
//   une destination réapparaît EN DUR dans un composant                ❌       ❌       ❌      ❌
//
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE QUE CETTE PORTE A DE PROPRE : ELLE MESURE UN ALLER-RETOUR **ÉCRITURE → SITE PUBLIC**
// ══════════════════════════════════════════════════════════════════════════════════════
//
// Les six autres portes de surface gardent une saisie et son rendu **sur la page de cette
// surface**. Ici, ce qui est écrit dans `site_setting` ressort dans le **header et le footer
// des 5 pages publiques** — la garde ③ écrit donc réellement en base, puis va LIRE le HTML
// servi des cinq pages. Et la garde ④ fait l'inverse : elle remet la colonne à `NULL` et
// vérifie qu'il ne reste **aucun** lien, parce que cette story rend le défaut **R2**
// atteignable *par la saisie* — R2 a vécu quatre epics avec huit ancres mortes par page.
//
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 DEUX GARDES LISENT LE **SOURCE**, ET C'EST DÉCLARÉ (⑥ et ⑦)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// La doctrine du projet est de mesurer des EFFETS (`gate:links`). Deux propriétés y échappent :
//
//   · ⑥ le compte SMTP ne doit PAS venir des réglages. Le mesurer par l'effet exigerait un
//     envoi réel, et **aucun message n'a jamais été émis sur ce projet** (dette R32) : la
//     lecture du source est le seul témoin disponible ;
//   · ⑦ tout export de `actions/reglages.ts` commence par `requireAdmin()`. L'effet d'une
//     Server Action exige une session, que cette porte n'a pas — même limite que
//     `gate:membres` et `gate:sollicitations`, déclarée en exemption.
//
// 🔴 CETTE PORTE ÉCRIT EN BASE, ET DANS LA TABLE LA PLUS SENSIBLE DU PROJET : une seule ligne,
// consommée par le chrome de tout le site. Elle relève son état **exact** au démarrage, et le
// **restaure puis le RELIT et le COMPARE** en `finally`. Un `finally` qu'on ne vérifie pas
// n'est pas un ménage.
//
// Usage :  pnpm --filter vitrine gate:reglages [baseUrl]
//          REGLAGES_AUTOTEST=1 …  → auto-validation de l'instrument
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

import { launchChrome } from "./cdp.mjs";
import { BASE as BASE_DEFAUT, PAGES } from "./config.mjs";
import { siteSettingInputSchema } from "../../src/lib/schemas/site-setting";
import { classerDestination } from "../../src/lib/links";

const BASE = process.argv[2] ?? BASE_DEFAUT;
const AUTOTEST = process.env.REGLAGES_AUTOTEST === "1";

const echecs: string[] = [];
const succes: string[] = [];
const exemptions = new Set<string>();
const ko = (garde: string, ou: string, quoi: string) => echecs.push(`${garde} ${ou} — ${quoi}`);
const ok = (garde: string, ou: string, quoi: string) => succes.push(`${garde} ${ou} — ${quoi}`);

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE_APP = join(ICI, "..", "..");
const lireSource = (chemin: string) => readFileSync(join(RACINE_APP, chemin), "utf8");

async function corpsDe(chemin: string) {
  const reponse = await fetch(BASE + chemin, { redirect: "manual" });
  return { statut: reponse.status, corps: await reponse.text() };
}

console.log(`\n🔎 Surface « réglages » — ${BASE}`);
if (AUTOTEST) {
  console.log("   MODE AUTO-VALIDATION : on présente à chaque garde un cas qu'elle doit voir.");
}

// ══════════════════════════════════════════════════════════════════════════════════════
// BASE DE DÉVELOPPEMENT
// ══════════════════════════════════════════════════════════════════════════════════════

function lireVariable(nom: string): string | null {
  if (process.env[nom]) return process.env[nom]!;
  try {
    const contenu = readFileSync(join(RACINE_APP, ".env.local"), "utf8");
    const ligne = contenu.split(/\r?\n/).find((l) => l.trim().startsWith(`${nom}=`));
    return ligne
      ? ligne
          .slice(ligne.indexOf("=") + 1)
          .trim()
          .replace(/^["']|["']$/g, "")
      : null;
  } catch {
    return null;
  }
}

const urlBase = lireVariable("DATABASE_URL");
if (!urlBase) {
  console.log("🔴 DATABASE_URL introuvable — cette porte ne peut pas s'exécuter.");
  process.exit(1);
}

// ⚠️ `max: 1` ET aucune requête externe à l'intérieur d'un `sql.begin` : `gate:partenaires`
// (6.5) puis `gate:membres` (6.10) se sont BLOQUÉES — pas « échouées », bloquées, sans rendre
// AUCUN verdict — parce qu'une connexion externe était utilisée sur un pool de 1.
const sql = postgres(urlBase, { max: 1, onnotice: () => {} });

type LigneReglages = {
  id: number;
  discord_url: string | null;
  instagram_url: string | null;
  x_url: string | null;
  linkedin_url: string | null;
  helloasso_url: string | null;
  contact_email: string;
  /** Restauré tel quel : la porte ne doit pas laisser croire que l'équipe a touché aux réglages. */
  updated_at: Date;
};

// 🔴 L'ÉTAT D'ENTRÉE EST RELEVÉ AVANT TOUT, ET IL SERA COMPARÉ CHAMP PAR CHAMP EN SORTIE.
// Cette table n'a qu'UNE ligne : la porte ne peut pas « ajouter puis supprimer ses lignes »
// comme les six autres. Elle MODIFIE la seule qui existe, donc son ménage est une RESTAURATION,
// et une restauration qu'on ne relit pas n'est pas prouvée.
const etatEntree = (await sql<LigneReglages[]>`select * from site_setting`)[0] ?? null;
if (!etatEntree) {
  console.log("🔴 site_setting est VIDE — la migration 0012 n'a pas été jouée sur cette base.");
  await sql.end();
  process.exit(1);
}

const URL_TEMOIN = "https://exemple-gate-6-13.test/temoin";
const EMAIL_TEMOIN = "zz-temoin-reglages-613@exemple-gate.test";

let restauration = "non tentée";
let restaurationEvenements = "aucun événement masqué";
let chrome: Awaited<ReturnType<typeof launchChrome>> | null = null;

/** Identifiants des événements dépubliés le temps de la mesure — restaurés en `finally`. */
const idsEvenementsMasques: string[] = [];

try {
  // ══════════════════════════════════════════════════════════════════════════════════════
  // ① 🔴 LES SEPT `CHECK` SONT LUS DANS LEUR **TEXTE**, PAS ÉPROUVÉS PAR UNE ÉCRITURE
  // ══════════════════════════════════════════════════════════════════════════════════════
  //
  // Leçon la plus chère de l'Epic 6 (Story 6.9) : `event_has_venue` s'écrivait
  // `bar_id is not null or length(btrim(venue_name)) > 0` et valait `FALSE OR NULL` = **NULL**
  // dans le cas EXACT qu'il existait pour interdire — et **un `CHECK` qui vaut `NULL` PASSE**.
  // Il a survécu à trois epics. La contre-épreuve par écriture y est aveugle PAR CONSTRUCTION,
  // parce que le défaut la rend verte. Cette table a **cinq** colonnes nullables : cinq
  // occasions de le refaire d'un coup. Le seul témoin qui tranche est la LECTURE.
  const contraintes = await sql<{ conname: string; definition: string }[]>`
    select conname, pg_get_constraintdef(oid) as definition
    from pg_constraint
    where conrelid = 'site_setting'::regclass and contype = 'c'
  `;
  const parContrainte = new Map(contraintes.map((c) => [c.conname, c.definition]));

  const COLONNES_URL = ["discord", "instagram", "x", "linkedin", "helloasso"] as const;
  const ATTENDUES: { nom: string; doitContenir: string[] }[] = [
    { nom: "site_setting_ligne_unique", doitContenir: ["id = 1"] },
    ...COLONNES_URL.map((c) => ({
      nom: `site_setting_${c}_url_valide`,
      // 🔴 `IS NULL` est la chaîne qui compte. Sans elle, la contrainte vaudrait `NULL` sur une
      // colonne vide — c'est-à-dire dans le cas nominal (dette R29 : les 5 URL sont absentes).
      doitContenir: ["IS NULL", "<= 300", "^https?://"],
    })),
    {
      nom: "site_setting_contact_email_valide",
      // 🔴 `\.` EST LE TÉMOIN DU **PIÈGE DU POINT** : si l'échappement JS avait mangé
      // l'antislash, le motif serait toujours là mais `\.` serait devenu `.` — et `a@bXfr`
      // passerait le CHECK. On exige donc la forme échappée explicitement.
      //
      // ⚠️ L'AIGUILLE A ÉTÉ FAUSSE, ET ELLE ACCUSAIT LE PRODUIT (défaut d'instrument mesuré au
      // dev de la 6.13). Elle cherchait `[[:space:]]`, avec deux crochets ouvrants — or le
      // motif s'écrit `[^[:space:]@]` : la classe POSIX y est toujours précédée d'un `[^`,
      // jamais d'un `[`. MESURÉ en base : `position('[[:space:]]' in …)` → **0**,
      // `position('[:space:]' in …)` → **104**. La contrainte était parfaitement saine ; c'est
      // la porte qui cherchait une chaîne qui ne peut exister dans AUCUN texte de contrainte.
      doitContenir: ["btrim", "<= 254", "\\.", "[:space:]"],
    },
  ];

  for (const attendue of ATTENDUES) {
    const definition = parContrainte.get(attendue.nom);
    const cherchees = AUTOTEST ? ["CETTE_CHAINE_N_EXISTE_PAS"] : attendue.doitContenir;
    if (!definition) {
      ko("①", attendue.nom, "CONTRAINTE ABSENTE de la table");
      continue;
    }
    const manquantes = cherchees.filter((c) => !definition.includes(c));
    if (manquantes.length === 0) {
      ok("①", attendue.nom, `texte conforme (${cherchees.join(" · ")})`);
    } else {
      ko("①", attendue.nom, `il MANQUE ${manquantes.join(", ")} dans « ${definition} »`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════════════
  // ② LE SINGLETON TIENT — UNE SECONDE LIGNE EST REFUSÉE
  // ══════════════════════════════════════════════════════════════════════════════════════
  // Sans cette garde, « table à ligne unique » ne serait qu'une intention : le lecteur ferait
  // `limit 1` sur un ensemble non ordonné, et le chrome des 5 pages pourrait changer d'une
  // requête à l'autre.
  {
    let refusee = false;
    try {
      await sql.begin(async (t) => {
        if (AUTOTEST) {
          // On joue une écriture LÉGITIME : la garde attend un refus, elle doit donc échouer.
          await t`update site_setting set updated_at = now() where id = 1`;
        } else {
          await t`insert into site_setting (id, contact_email) values (2, 'a@b.fr')`;
        }
        throw new Error("ROLLBACK_VOULU");
      });
    } catch (erreur) {
      const message = String((erreur as { message?: string }).message ?? erreur);
      refusee = !message.includes("ROLLBACK_VOULU");
    }
    if (refusee) ok("②", "base", "refuse une SECONDE ligne dans site_setting");
    else ko("②", "base", "ACCEPTE une seconde ligne — la table n'est pas un singleton");
  }

  // ══════════════════════════════════════════════════════════════════════════════════════
  // ⑧ ABSENCE — AUCUNE COLONNE DE TEXTE LIBRE DANS `site_setting`
  // ══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 C'est la seule règle de cette story qu'aucune relecture ne tiendrait dans six mois :
  // « ajoute donc le titre du site tant qu'on y est » est la demande la plus naturelle du
  // monde, et elle est exactement ce que l'arbitrage de Brice du 2026-07-29 a écarté (colonnes
  // typées, NFR8) et ce que Q6 interdit (la prose éditoriale reste en dur). Patron de la garde
  // d'absence de `gate:ateliers` (aucune colonne de tarif/durée/effectif).
  {
    const colonnes = (
      await sql<{ column_name: string }[]>`
        select column_name from information_schema.columns
        where table_name = 'site_setting' and table_schema = 'public'
      `
    ).map((c) => c.column_name);

    const ATTENDUES_EXACTES = [
      "id",
      "discord_url",
      "instagram_url",
      "x_url",
      "linkedin_url",
      "helloasso_url",
      "contact_email",
      "updated_at",
    ];
    const enTrop = colonnes.filter((c) => !ATTENDUES_EXACTES.includes(c));
    // En autotest, on retire une colonne légitime de la liste attendue : elle apparaît alors
    // « en trop » et la garde doit tomber.
    const enTropEprouve = AUTOTEST ? [...enTrop, "contact_email"] : enTrop;

    if (enTropEprouve.length === 0) {
      ok("⑧", "site_setting", `${colonnes.length} colonnes, aucune de texte libre ni de contenu`);
    } else {
      ko(
        "⑧",
        "site_setting",
        `colonne(s) NON PRÉVUE(S) : ${enTropEprouve.join(", ")} — la table doit rester six ` +
          "réglages typés (arbitrage 2026-07-29, NFR8/Q6), jamais un magasin de contenu",
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════════════
  // ⑩ ZOD REFUSE CE QUE `isExternalUrl()` NE SAURAIT PAS RECONNAÎTRE
  // ══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 ON EXERCE LE **VRAI** SCHÉMA, pas une copie de son contrat : une porte qui réimplémente
  // sa règle valide sa propre copie et reste verte le jour où le produit diverge
  // (`pieges/garde-nominale.md`). Les trois formes ci-dessous passaient `z.url()` puis étaient
  // classées INTERNES — donc rendues sans `target="_blank"` ni annonce SR. Défaut trouvé en
  // revue de la 6.5 ; en 6.13 il serait rendu dans le header et le footer des 5 pages.
  {
    const REFUSER = [
      "HTTPS://exemple.fr",
      "https:exemple.fr",
      "https:/exemple.fr",
      "mailto:a@b.fr",
      "javascript:alert(1)",
      "exemple.fr",
      "/agenda",
    ];
    const ACCEPTER = ["https://discord.gg/abc", "http://exemple.fr/page?a=1"];

    const base = {
      instagramUrl: "",
      xUrl: "",
      linkedinUrl: "",
      helloassoUrl: "",
      contactEmail: "a@b.fr",
    };

    for (const valeur of AUTOTEST ? ACCEPTER : REFUSER) {
      const resultat = siteSettingInputSchema.safeParse({ ...base, discordUrl: valeur });
      if (!resultat.success) ok("⑩", "zod", `refuse « ${valeur} »`);
      else ko("⑩", "zod", `ACCEPTE « ${valeur} » — elle serait classée INTERNE par le rendu`);
    }

    // Contre-épreuve : une vraie URL passe, ET le classificateur du rendu la voit sortante.
    for (const valeur of ACCEPTER) {
      const resultat = siteSettingInputSchema.safeParse({ ...base, discordUrl: valeur });
      const classee = classerDestination(valeur);
      if (resultat.success && classee === "externe") {
        ok("⑩", "zod↔links", `« ${valeur} » acceptée ET classée « externe »`);
      } else {
        ko(
          "⑩",
          "zod↔links",
          `« ${valeur} » : zod=${resultat.success ? "ok" : "refusée"}, classée « ${classee} » — ` +
            "le schéma et le rendu ne disent pas la même chose",
        );
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════════════
  // ⑥ 🔴 LECTURE DE SOURCE — LE COMPTE SMTP N'EST PAS LE RÉGLAGE
  // ══════════════════════════════════════════════════════════════════════════════════════
  // Le fait le plus dangereux de cette story : `client.ts` utilisait `CONTACT_EMAIL` comme
  // `auth.user`. Rendre cette valeur saisissable invaliderait l'authentification Gmail, et le
  // découplage envoi/persistance de la 5.1 rendrait la panne **totalement silencieuse**.
  // ⚠️ Mesurer l'EFFET exigerait un envoi réel : aucun message n'a jamais été émis (R32).
  {
    const source = lireSource("src/server/mail/client.ts");
    const aLaConstante = /auth:\s*\{\s*user:\s*COMPTE_SMTP\s*,/.test(source);
    // 🔴 ON CHERCHE UN **IMPORT**, PAS UNE MENTION — ET LA NUANCE A COÛTÉ UN VERDICT ROUGE
    // SUR UN FICHIER SAIN (défaut d'instrument mesuré au dev de la 6.13, 2ᵉ du même run).
    // La 1ʳᵉ version testait `/lireReglages|site_setting|queries\/settings/` sur tout le
    // fichier : elle tombait sur les **deux lignes de commentaire** qui expliquent précisément
    // pourquoi le compte SMTP n'est PAS `site_setting.contact_email`. La porte accusait donc le
    // texte qui porte la règle qu'elle garde — exactement le défaut relevé à la revue de la
    // 6.11, où un finding aurait fait supprimer un commentaire pour faire taire sa propre garde.
    // Le seul témoin qui distingue « lit les réglages » de « parle des réglages » est l'import.
    const litLesReglages = /^\s*import[^\r\n]*(queries\/settings|lireReglages)/m.test(source);
    // En autotest on inverse l'attente : la garde doit tomber sur un fichier sain.
    const conforme = AUTOTEST ? !aLaConstante : aLaConstante && !litLesReglages;
    if (conforme) {
      ok("⑥", "server/mail/client.ts", "`auth.user` = COMPTE_SMTP, et le module ne lit PAS les réglages");
    } else {
      ko(
        "⑥",
        "server/mail/client.ts",
        "l'identité SMTP ne vient plus d'une constante (ou le module lit les réglages) — " +
          "un e-mail de contact modifié casserait l'envoi EN SILENCE",
      );
    }

    const notif = lireSource("src/server/mail/notifySolicitation.ts");
    const fromConstant = /from:\s*COMPTE_SMTP/.test(notif);
    const toReglage = /to:\s*contactEmail/.test(notif);
    if (AUTOTEST ? !fromConstant : fromConstant && toReglage) {
      ok("⑥", "notifySolicitation.ts", "`from` = COMPTE_SMTP (constante), `to` = réglage lu en base");
    } else {
      ko(
        "⑥",
        "notifySolicitation.ts",
        `from constant : ${fromConstant} · to depuis le réglage : ${toReglage} — les deux sont exigés`,
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════════════
  // ⑦ 🔴 LECTURE DE SOURCE — TOUT EXPORT DE `actions/reglages.ts` COMMENCE PAR `requireAdmin()`
  // ══════════════════════════════════════════════════════════════════════════════════════
  // Un matcher de proxy NE COUVRE PAS les Server Actions (doc Next 16, § Execution order) :
  // c'est la SEULE couche qui protège cette écriture, et elle est invisible pour lint,
  // typecheck et build.
  {
    const source = lireSource("src/server/actions/reglages.ts");
    const exports = [...source.matchAll(/export\s+async\s+function\s+(\w+)\s*\(/g)].map((m) => m[1]!);
    if (exports.length === 0) {
      ko("⑦", "actions/reglages.ts", "AUCUN export asynchrone trouvé — la garde ne mesure rien");
    }
    for (const nom of exports) {
      const debut = source.indexOf(`export async function ${nom}`);
      const corps = source.slice(debut, debut + 1400);
      const gardee = AUTOTEST ? false : /await requireAdmin\(\)/.test(corps);
      if (gardee) ok("⑦", `actions/reglages.ts#${nom}`, "appelle `await requireAdmin()`");
      else ko("⑦", `actions/reglages.ts#${nom}`, "N'APPELLE PAS `await requireAdmin()`");
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════════════
  // ⑪ AUCUNE DESTINATION EN DUR — `lib/links.ts` A CESSÉ D'ÊTRE LA SOURCE DE VÉRITÉ
  // ══════════════════════════════════════════════════════════════════════════════════════
  // La promesse de l'AC4 (« il cesse d'être la source de vérité ») n'est vérifiable que
  // négativement : il ne doit plus rien rester à diverger.
  {
    const links = lireSource("src/lib/links.ts");
    const DISPARUES = [
      "DISCORD_URL",
      "INSTAGRAM_URL",
      "X_URL",
      "LINKEDIN_URL",
      "REJOINDRE_URL",
      "CONTACT_EMAIL",
    ];
    // On cherche des DÉCLARATIONS, pas des mentions : ce fichier PARLE de ces constantes dans
    // son en-tête, pour dire où elles sont parties. Une porte qui grep le nom nu accuserait la
    // documentation. (12ᵉ occurrence évitée de `pieges/instrument-non-valide.md`.)
    const encoreDeclarees = DISPARUES.filter((n) =>
      new RegExp(`export\\s+const\\s+${n}\\b`).test(links),
    );
    // ⚠️ `TOURNOI_URL` EST LE TÉMOIN D'AUTOTEST, ET SON STATUT A CHANGÉ EN 9.4 — relu, pas
    // modifié. La chaîne est injectée EN LITTÉRAL, sans être cherchée dans le source : c'est
    // ce qui fait que l'autotest rougit de façon déterministe, quoi que devienne le fichier.
    // 🔴 CE QUE CETTE GARDE MESURE N'A PAS CHANGÉ : les SIX destinations saisissables ont bien
    // quitté `lib/links.ts` pour `site_setting`. `TOURNOI_URL` n'a jamais fait partie des six,
    // et depuis la Story 9.4 elle n'est même plus une « destination » — c'est une ROUTE INTERNE
    // (`/tournois`), donc un fait du code, comme `/agenda`. Elle reste dans `lib/links.ts` et
    // doit y rester : la rendre saisissable offrirait un moyen de casser la navigation du site
    // depuis un formulaire.
    // ⚠️ Ne pas la retirer d'ici « puisqu'elle a changé de nature » : ce serait retirer le seul
    // témoin qui prouve que cette garde SAIT rougir.
    const eprouvees = AUTOTEST ? [...encoreDeclarees, "TOURNOI_URL"] : encoreDeclarees;
    if (eprouvees.length === 0) {
      ok("⑪", "lib/links.ts", "ne déclare AUCUNE des 6 destinations — elles vivent en base");
    } else {
      ko("⑪", "lib/links.ts", `déclare encore ${eprouvees.join(", ")} — deux sources de vérité`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════════════
  // ⑫ LA ROUTE D'ADMINISTRATION EST FERMÉE SANS SESSION — ET ON LIT LE **CORPS**
  // ══════════════════════════════════════════════════════════════════════════════════════
  // Leçon `gate:admin` (6.1) : le corps d'un `307` portait tout le tableau de bord. Un code de
  // statut n'est pas une preuve d'absence de fuite.
  {
    const route = AUTOTEST ? "/admin/login" : "/admin/reglages";
    const r = await corpsDe(route);
    const MARQUEURS = ["Enregistrer les réglages", "E-mail de contact", "Réglages du site"];
    const fuite = MARQUEURS.filter((m) => r.corps.includes(m));
    if (fuite.length === 0) ok("⑫", route, `aucun marqueur de l'écran dans le corps servi (${r.statut})`);
    else ko("⑫", route, `le corps servi contient ${fuite.map((f) => `« ${f} »`).join(", ")}`);
  }

  // ══════════════════════════════════════════════════════════════════════════════════════
  // MOITIÉ NAVIGATEUR — L'ALLER-RETOUR ÉCRITURE → SITE PUBLIC
  // ══════════════════════════════════════════════════════════════════════════════════════
  chrome = await launchChrome(9361);

  /**
   * Relève, sur la page courante, tout ce dont les gardes ③, ④ et ⑨ ont besoin.
   *
   * 🔴 ON MESURE DES **EFFETS** : `getComputedStyle`, pas la lecture d'une classe CSS Module
   * (elle est HACHÉE à la compilation, donc illisible depuis ici — leçon `gate:links`).
   */
  const COLLECTE = `(() => {
    // 🔴 ON COMPARE LE TEXTE **VISIBLE**, ET IL A FALLU TROIS TENTATIVES.
    //
    // Ce prédicat a été faux DEUX fois de suite, et la seconde fois en FAUX NÉGATIF —
    // la forme d'erreur d'instrument qui se confond avec le succès (rétro Epic 5) :
    //
    //   1re version : textContent.trim() === "Discord". Juste sur le span INERTE, FAUX sur le
    //     cas ACTIF — un lien sortant rend "Discord" suivi d'un span sr-only " (nouvel onglet)".
    //   2e version : on retirait l'annonce par une regex à parenthèses échappées. Or ce bloc
    //     vit dans un LITTÉRAL DE GABARIT JS : un antislash-parenthèse y est un échappement non
    //     reconnu et s'évalue en parenthèse nue. Le navigateur recevait donc un GROUPE DE
    //     CAPTURE : "Discord (nouvel onglet)" devenait "Discord ()", jamais égal à "Discord".
    //     La garde ⑨ concluait "aucune mention en prose" et **s'exemptait elle-même**.
    //     C'est le MÊME piège d'échappement à deux étages que le point du motif SQL (6.5, 6.10).
    //
    // Parade : on ne bricole plus de chaîne, on RETIRE le sr-only du DOM cloné. La classe
    // "sr-only" est GLOBALE (globals.css) et non un CSS Module, donc son nom n'est pas haché :
    // le sélecteur est exact. Et aucun accent grave ni antislash dans ce bloc.
    const texteVisible = (el) => {
      const clone = el.cloneNode(true);
      clone.querySelectorAll(".sr-only").forEach((n) => n.remove());
      return (clone.textContent || "").trim();
    };
    const texteDiscord = (el) => texteVisible(el) === "Discord";
    const mentions = [...document.querySelectorAll("span[data-inerte], a")]
      .filter(texteDiscord)
      // On ne garde que la PROSE : les tuiles du footer et du header n'ont pas de texte
      // (icône + aria-label), elles ne peuvent donc pas remonter ici. Filtrer sur la balise
      // suffit, mais on l'écrit pour que la porte dise ce qu'elle regarde.
      .map((el) => ({
        balise: el.tagName.toLowerCase(),
        href: el.getAttribute("href"),
        inerte: el.hasAttribute("data-inerte"),
        souligne: getComputedStyle(el).textDecorationLine.includes("underline"),
      }));

    const html = document.documentElement.outerHTML;
    const liens = [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
    const inertes = [...document.querySelectorAll("[data-inerte]")].map((el) => ({
      focalisable: el.hasAttribute("href") || el.hasAttribute("tabindex") || el.hasAttribute("role"),
      annonce: /nouvel onglet/i.test(el.textContent || "") ||
               /nouvel onglet/i.test(el.getAttribute("aria-label") || ""),
    }));
    return { mentions, html, liens, inertes };
  })()`;

  type Releve = {
    mentions: { balise: string; href: string | null; inerte: boolean; souligne: boolean }[];
    html: string;
    liens: (string | null)[];
    inertes: { focalisable: boolean; annonce: boolean }[];
  };

  const relever = async (page: string): Promise<Releve> => {
    await chrome!.setViewport(1280);
    await chrome!.goto(BASE + page);
    return (await chrome!.eval(COLLECTE)) as Releve;
  };

  // ── ③ UNE VALEUR ÉCRITE RESSORT DANS LE CHROME DES 5 PAGES ───────────────────────────
  await sql`
    update site_setting
    set discord_url = ${URL_TEMOIN}, instagram_url = ${URL_TEMOIN},
        x_url = ${URL_TEMOIN}, linkedin_url = ${URL_TEMOIN},
        helloasso_url = ${URL_TEMOIN}, contact_email = ${EMAIL_TEMOIN}
    where id = 1
  `;

  // En autotest, on cherche une valeur qui n'a JAMAIS été écrite : la garde doit tomber.
  const AIGUILLE_URL = AUTOTEST ? "https://valeur-jamais-ecrite.test" : URL_TEMOIN;
  const AIGUILLE_EMAIL = AUTOTEST ? "jamais-ecrit@nulle-part.test" : EMAIL_TEMOIN;

  for (const page of PAGES) {
    const { html, mentions } = await relever(page);
    const aUrl = html.includes(AIGUILLE_URL);
    const aEmail = html.includes(AIGUILLE_EMAIL);
    if (aUrl && aEmail) {
      ok("③", page, "l'URL ET l'e-mail saisis ressortent dans le HTML servi (header/footer)");
    } else {
      ko(
        "③",
        page,
        `URL saisie présente : ${aUrl} · e-mail saisi présent : ${aEmail} — une saisie qui ` +
          "n'atteint pas le chrome est une saisie qui ne sert à rien",
      );
    }

    // ── ⑨ (moitié « renseignée ») LE MOT REDEVIENT UN VRAI LIEN, SOULIGNÉ ───────────────
    const enProse = mentions.filter((m) => m.balise === "a");
    const inertesEnProse = mentions.filter((m) => m.inerte);
    if (mentions.length === 0) {
      // 🔴 ON NE PASSE PAS EN SILENCE. Une garde qui ne trouve pas son sujet doit le DIRE :
      // l'état vide du hub et celui d'`/agenda` ne se rendent que sans événement à venir.
      exemptions.add(
        `⑨ : aucune mention « Discord » EN PROSE sur ${page} dans l'état actuel de la base ` +
          "(les états vides du hub et d'/agenda exigent zéro événement à venir). La garde n'a " +
          "donc rien mesuré SUR CETTE PAGE.",
      );
    } else if (inertesEnProse.length > 0) {
      ko("⑨", page, `${inertesEnProse.length} mention(s) inerte(s) alors que discord_url est RENSEIGNÉE`);
    } else {
      const sansSouligne = enProse.filter((m) => !m.souligne);
      if (AUTOTEST ? sansSouligne.length > 0 : sansSouligne.length === 0) {
        ok("⑨", page, `${enProse.length} mention(s) « Discord » cliquable(s) ET soulignée(s)`);
      } else {
        ko(
          "⑨",
          page,
          `${sansSouligne.length} mention(s) « Discord » CLIQUABLE(S) MAIS NON SOULIGNÉE(S) — ` +
            "l'affordance du lien est portée par le souligné (le CSS le déclare lui-même)",
        );
      }
    }
  }

  // ── ④ + ⑨ (moitié « absente ») UNE VALEUR VIDÉE NE LAISSE AUCUN LIEN MORT ────────────
  // 🔴 C'est le cœur du risque de cette story : R2 devient atteignable PAR LA SAISIE.
  await sql`
    update site_setting
    set discord_url = null, instagram_url = null, x_url = null,
        linkedin_url = null, helloasso_url = null
    where id = 1
  `;

  // ══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 ON FAIT APPARAÎTRE LES ÉTATS VIDES — SANS QUOI LA GARDE ⑨ NE COUVRE QU'UN TIERS
  //    DU CORRECTIF QU'ELLE EXISTE POUR GARDER
  // ══════════════════════════════════════════════════════════════════════════════════════
  //
  // La dette R33 ③ porte sur **TROIS** mentions « Discord » en prose : l'aside d'`/agenda`
  // (toujours rendu), l'état vide d'`/agenda` et l'état vide du hub de `/`. Les deux derniers
  // ne se rendent que s'il n'y a **aucun événement à venir publié** — c'est-à-dire jamais sur
  // une base de développement peuplée. Une porte qui se contente de son exemption laisserait
  // donc **deux fichiers CSS sur trois** sans aucune mesure, dont `EventHub.module.css`, qui
  // n'est touché par rien d'autre.
  //
  // On dépublie donc les événements à venir, le temps de la mesure, et on RESTAURE la liste
  // exacte des identifiants touchés dans le `finally`. ⚠️ On ne supprime rien et on ne
  // republie rien qui ne l'était : seuls les `id` relevés ici sont remis à `true`.
  const evenementsMasques = (
    await sql<{ id: string }[]>`
      update event set is_published = false
      where is_published = true and starts_at >= now()
      returning id
    `
  ).map((e) => e.id);
  idsEvenementsMasques.push(...evenementsMasques);

  for (const page of PAGES) {
    const { html, liens, inertes, mentions } = await relever(page);

    const resteUrl = html.includes(URL_TEMOIN);
    const ancresMortes = liens.filter((h) => h === "#" || h === "" || h === URL_TEMOIN);
    const inertesFocalisables = inertes.filter((i) => i.focalisable);
    const inertesBavards = inertes.filter((i) => i.annonce);

    // En autotest, on exige l'inverse : la garde doit tomber sur une page saine.
    const conforme = AUTOTEST
      ? false
      : !resteUrl &&
        ancresMortes.length === 0 &&
        inertesFocalisables.length === 0 &&
        inertesBavards.length === 0;

    if (conforme) {
      ok(
        "④",
        page,
        `valeurs vidées : 0 trace de l'URL, 0 ancre morte, ${inertes.length} élément(s) inerte(s) ` +
          "non focalisables et sans annonce trompeuse",
      );
    } else {
      ko(
        "④",
        page,
        `URL résiduelle : ${resteUrl} · ancres mortes : ${ancresMortes.length} · inertes ` +
          `focalisables : ${inertesFocalisables.length} · annonces trompeuses : ${inertesBavards.length}`,
      );
    }

    // ⑨ moitié « absente » — LE DÉFAUT R33 ③ EST ICI, ET AUCUNE AUTRE PORTE NE LE VOIT.
    // `gate:links` garde ⑥ ne mesure que le SURVOL d'un élément inerte ; le souligné, lui,
    // est rendu AU REPOS. Un mot souligné qui ne clique pas promet une action impossible.
    const inertesEnProse = mentions.filter((m) => m.inerte);
    if (inertesEnProse.length === 0) {
      // (l'exemption a déjà été déclarée plus haut si la page n'a aucune mention)
      if (mentions.length > 0) {
        ko("⑨", page, "des mentions « Discord » restent CLIQUABLES alors que discord_url est vide");
      }
    } else {
      const soulignesAuRepos = inertesEnProse.filter((m) => m.souligne);
      if (AUTOTEST ? soulignesAuRepos.length === 0 : soulignesAuRepos.length === 0) {
        ok(
          "⑨",
          page,
          `${inertesEnProse.length} mention(s) « Discord » inerte(s) et NON soulignée(s) (dette R33 ③)`,
        );
      } else {
        ko(
          "⑨",
          page,
          `${soulignesAuRepos.length} mention(s) « Discord » SOULIGNÉE(S) alors qu'elle(s) ne ` +
            "clique(nt) pas — dette R33 ③ : un mot souligné promet une action impossible",
        );
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════════════
  // ⑬ 🔴 UNE VALEUR SAISIE NE DOIT JAMAIS S'ÉCHAPPER DU HTML QUI LA PORTE
  //    (injection de BALISAGE — pas d'exécution de script, et la nuance est mesurée)
  // ══════════════════════════════════════════════════════════════════════════════════════
  //
  // Garde ajoutée APRÈS LA REVUE (Edge Case Hunter), sur un défaut RÉEL et MESURÉ, que cette
  // story avait elle-même introduit.
  //
  // `SolicitationDialog` rend son repli `<noscript>` par `dangerouslySetInnerHTML` — montage
  // légitime (React ne rend pas de façon fiable des enfants JSX dans un `<noscript>`), et
  // parfaitement sûr TANT QUE le contenu était statique. Cette story a rendu `contactEmail`
  // **saisissable**, donc la chaîne interpolée est devenue une donnée. Le commentaire du
  // fichier affirmait pourtant encore « aucune donnée utilisateur — aucune surface
  // d'injection » : un avertissement FAUX est pire qu'absent, parce qu'il est CRU.
  //
  // ⚠️ CE N'EST PAS UN XSS AVEC EXÉCUTION, ET LE DIRE JUSTE COMPTE. Un `<script>` inséré par
  // `innerHTML` n'est jamais exécuté (comportement DOM standard), et le contenu d'un
  // `<noscript>` n'est parsé comme du balisage QUE si le scripting est désactivé — auquel cas
  // aucun gestionnaire d'événement ne s'exécute non plus. Ce qui reste, et qui est réel : de
  // l'**injection de balisage** servie à tout visiteur sans JS — une redirection
  // `<meta http-equiv="refresh">`, un faux formulaire, un contenu trompeur. Le déclencheur est
  // une saisie d'administrateur, donc le rayon est borné par une confiance déjà accordée : la
  // garde existe pour la **saisie imparfaite**, pas contre un administrateur hostile.
  // ⚠️ Le motif e-mail est DÉLIBÉRÉMENT minimal (`[^\s@]+@[^\s@]+\.[^\s@]+`) : durcir la
  // validation refuserait des adresses valides, et la vraie validation d'une adresse est
  // l'envoi d'un message. La garde ne porte donc PAS sur ce qui entre en base — elle porte sur
  // ce qui SORT dans le HTML. C'est la bonne couche : l'échappement.
  //
  // 🔴 ELLE MESURE LE HTML SERVI, PAS LE SOURCE. Une relecture de code dirait « il y a un
  // échappement » ; seule la lecture du corps servi dit qu'il TIENT.
  {
    // 🔴 LA CHARGE DOIT ÊTRE STOCKABLE, ET LA PREMIÈRE NE L'ÉTAIT PAS — défaut d'instrument
    // mesuré au traitement de la revue. Elle contenait des ESPACES
    // (`<meta http-equiv=refresh content=0>`), or le motif de `site_setting_contact_email_valide`
    // est `[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+` : aucun espace nulle part. Le `CHECK`
    // l'a refusée (`23514`) et la porte a **planté** au lieu de rendre un verdict — la forme la
    // moins coûteuse d'instrument faux, mais un instrument faux quand même.
    // Parade : le vecteur RÉELLEMENT atteignable, relevé en revue, qui remplace les espaces par
    // des `/` — séparateurs équivalents pour l'analyseur de balises HTML. Vérifié contre le
    // `CHECK` avant d'être utilisé ici : `~` renvoie `t`.
    // ⚠️ On garde aussi une balise `<script>` comme témoin d'échappement, tout en sachant
    // qu'elle ne s'exécuterait PAS (voir l'en-tête de cette garde).
    const CHARGE =
      'zz"/><meta/http-equiv=refresh/content=0;url=https://evil.test/<script>alert(1)</script>@exemple-gate.test';
    await sql`update site_setting set contact_email = ${CHARGE} where id = 1`;

    // `SolicitationDialog` est monté sur ces trois pages (via `DoubleDoor` sur `/`).
    for (const page of ["/", "/animations", "/partenaires"]) {
      const r = await corpsDe(page);
      // En autotest, on cherche une chaîne SÛRE : la garde doit alors tomber.
      const sorties = AUTOTEST
        ? ["<a "]
        : ['<meta/http-equiv=refresh', "<script>alert(1)</script>", 'href="mailto:zz"'];
      const trouvees = sorties.filter((s) => r.corps.includes(s));
      if (trouvees.length === 0) {
        ok("⑬", page, "la charge saisie ressort ÉCHAPPÉE — elle ne sort ni de l'attribut ni de la balise");
      } else {
        ko(
          "⑬",
          page,
          `INJECTION DE BALISAGE : la valeur de contact_email s'échappe du HTML ` +
            `(${trouvees.join(" · ")}) — une adresse saisie au back-office injecte du balisage ` +
            "arbitraire chez tout visiteur sans JavaScript",
        );
      }
      // Contre-épreuve : la charge doit tout de même être PRÉSENTE, sous forme échappée.
      // Sans elle, une garde resterait verte si le repli disparaissait purement et simplement.
      if (!AUTOTEST && !r.corps.includes("zz&quot;") && !r.corps.includes("@exemple-gate.test")) {
        ko("⑬", page, "la charge n'apparaît NULLE PART : le repli <noscript> a disparu, la garde ne mesure plus rien");
      }
    }
  }

  // ── ⑤ LIGNE ABSENTE ⇒ REPLI HONNÊTE, PAS UNE 500 ─────────────────────────────────────
  // 🔴 Limite DÉCLARÉE de `lireReglages()`, et donc à ÉPROUVER : le lecteur retombe sur l'état
  // d'avant cette story plutôt que de faire rendre les 5 pages en erreur. Sans cette garde,
  // « le site reste honnête » ne serait qu'une phrase de commentaire.
  {
    await sql`delete from site_setting where id = 1`;
    let toutesServies = true;
    const details: string[] = [];
    for (const page of PAGES) {
      const r = await corpsDe(page);
      // En autotest, on exige un statut impossible : la garde doit tomber.
      const attendu = AUTOTEST ? 599 : 200;
      if (r.statut !== attendu) {
        toutesServies = false;
        details.push(`${page} → ${r.statut}`);
      }
      // Et l'e-mail de repli doit être servi : un repli qui rend une page vide n'est pas honnête.
      if (!AUTOTEST && !r.corps.includes("esportdessacres@gmail.com")) {
        toutesServies = false;
        details.push(`${page} → e-mail de repli absent`);
      }
    }
    if (toutesServies) {
      ok("⑤", "5 pages", "ligne supprimée : les 5 pages répondent 200 et servent l'e-mail de repli");
    } else {
      ko("⑤", "5 pages", `le repli ne tient pas : ${details.join(" · ")}`);
    }
  }
} finally {
  // ══════════════════════════════════════════════════════════════════════════════════════
  // RESTAURATION — TOUJOURS, MÊME SI UNE GARDE A LEVÉ, ET **RELUE**
  // ══════════════════════════════════════════════════════════════════════════════════════
  // Cette table n'a qu'une ligne : la porte ne « supprime pas ses lignes », elle REMET celle
  // du site dans son état d'entrée. Un `finally` qu'on ne vérifie pas n'est pas un ménage —
  // et ici l'oublier laisserait le site avec des réglages de test.
  if (chrome) await chrome.close?.();

  // ── Restauration des événements dépubliés pour faire apparaître les états vides ────────
  // ⚠️ On ne republie QUE les identifiants relevés, jamais « tous les événements » : la base
  // porte des brouillons légitimes, et les publier serait bien pire que de laisser une trace.
  if (idsEvenementsMasques.length > 0) {
    await sql`update event set is_published = true where id = any(${sql.array(idsEvenementsMasques)}::uuid[])`;
    const encoreMasques = Number(
      (
        await sql<{ n: number }[]>`
          select count(*)::int as n from event
          where id = any(${sql.array(idsEvenementsMasques)}::uuid[]) and is_published = false
        `
      )[0]!.n,
    );
    restaurationEvenements =
      encoreMasques === 0
        ? `${idsEvenementsMasques.length} événement(s) republié(s), 0 resté masqué`
        : `🔴 ${encoreMasques} événement(s) SONT RESTÉS DÉPUBLIÉS`;
  }

  await sql`delete from site_setting`;
  await sql`
    insert into site_setting (id, discord_url, instagram_url, x_url, linkedin_url,
                              helloasso_url, contact_email, updated_at)
    values (1, ${etatEntree.discord_url}, ${etatEntree.instagram_url}, ${etatEntree.x_url},
            ${etatEntree.linkedin_url}, ${etatEntree.helloasso_url}, ${etatEntree.contact_email},
            ${etatEntree.updated_at ?? new Date()})
  `;

  const apres = (await sql<LigneReglages[]>`select * from site_setting`)[0] ?? null;
  const champs = [
    "id",
    "discord_url",
    "instagram_url",
    "x_url",
    "linkedin_url",
    "helloasso_url",
    "contact_email",
  ] as const;
  const divergents = apres
    ? champs.filter((c) => String(apres[c] ?? "∅") !== String(etatEntree[c] ?? "∅"))
    : champs.slice();
  restauration = divergents.length === 0 ? "identique champ par champ" : `DIVERGE : ${divergents.join(", ")}`;
  await sql.end();
}

exemptions.add(
  "L'EFFET de la Server Action (enregistrement réellement exécuté, messages d'erreur rendus au " +
    "bénévole, focus au premier champ fautif). Elle exige une session, que cette porte n'a pas : " +
    "la garde ⑦ LIT le source, elle ne l'exerce pas. L'exercice appartient au gate visuel.",
);
exemptions.add(
  "🔴 L'ENVOI SMTP RÉEL (dette R32) : aucun message n'a jamais été émis sur ce projet. La garde " +
    "⑥ prouve que le compte d'authentification est une CONSTANTE — elle ne prouve pas qu'un " +
    "e-mail part, ni qu'il arrive au destinataire lu en base.",
);
exemptions.add(
  "Le RENDU : ton et lisibilité de l'écran de réglages, et surtout l'allure du footer avec ses " +
    "4 tuiles sociales VIVANTES — personne ne l'a jamais vue, elles sont inertes depuis la " +
    "Story 1.5. C'est la passe 1 du gate visuel, et elle ne s'outille pas (rétro Epic 5).",
);
exemptions.add(
  "Le DÉBORDEMENT d'une URL de 300 caractères dans le pied de page : `gate` le couvre sur les " +
    "PAGES PUBLIQUES, mais son 4ᵉ contrôle ne s'exécute que sur l'état de la base au moment où " +
    "il tourne. Le cas « URL très longue » appartient au gate visuel.",
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
console.log(`  🧹 site_setting restaurée : ${restauration}.`);
console.log(`  🧹 événements : ${restaurationEvenements}.`);
if (restaurationEvenements.startsWith("🔴")) {
  console.log("  🔴 LA PORTE A LAISSÉ DES ÉVÉNEMENTS DÉPUBLIÉS — ne pas se fier à son verdict.");
  process.exit(1);
}
if (!restauration.startsWith("identique")) {
  console.log("  🔴 LA PORTE A LAISSÉ SES VALEURS DE TEST — ne pas se fier à son verdict.");
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
  // plus discrète de `pieges/instrument-non-valide.md` (patron `gate:ateliers`).
  console.log("\n   ⚠️  DEUX GARDES N'ONT PAS DE CAS D'AUTO-VALIDATION, et ce n'est pas un oubli :");
  console.log("      · la contre-épreuve de ⑩ (« une vraie URL passe ET est classée externe »)");
  console.log("        EST déjà l'inverse du refus ; l'inverser à son tour ré-exécuterait ⑩.");
  console.log("      · la RESTAURATION finale n'est pas une garde numérotée mais un ménage, et");
  console.log("        elle est vérifiée par comparaison champ par champ, pas par autotest.");
  console.log("      ⇒ Leur verdict vert repose sur leur lecture, pas sur une mesure d'échec.");
  process.exit(0);
}

if (echecs.length > 0) {
  console.log(`\n🔴 ${echecs.length} GARDE(S) EN ÉCHEC.`);
  process.exit(1);
}
console.log(`\n✅ ${succes.length} GARDE(S) VERTE(S).`);
process.exit(0);
