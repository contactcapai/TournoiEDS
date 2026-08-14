// 🔬 GARDE COMPORTEMENTALE DU CARROUSEL « déjà passé » (/agenda, Story 3.3).
//
// Pourquoi un contrôle dédié : Lighthouse **n'audite pas** `scrollable-region-focusable`
// (vérifié — l'audit est absent de son jeu par défaut), et aucune des portes existantes
// ne sait dire si un carrousel DÉFILE. Or la leçon R19 du projet est précisément
// celle-là : `position: sticky` présent dans le CSS ne prouvait rien, il a fallu
// scroller puis relever la position. Un `overflow-x: auto` présent dans le CSS ne
// prouve pas davantage qu'on peut atteindre la 4ᵉ vignette.
//
// Ce que ce contrôle exige, et qui ne se lit dans aucun fichier source :
//   ① les 4 vignettes sont dans le DOM AVANT toute interaction (donc sans JS aussi) ;
//   ② la région défilante est atteignable au clavier (tabindex) et réellement défilable ;
//   ③ les flèches apparaissent APRÈS hydratation (amélioration progressive) ;
//   ④ au départ : « plus récent » désactivée, « plus ancien » active ;
//   ⑤ un clic sur « plus ancien » fait RÉELLEMENT avancer le défilement ;
//   ⑥ arrivé au bout, « plus ancien » se désactive et « plus récent » s'active.
//
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 SONDE D'ENTRÉE SUR LES **DONNÉES** — DETTE **R46**, SOLDÉE PAR LA STORY 9.2
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔬 MESURÉ le 2026-08-13 contre `https://staging.esportdessacres.fr` : cette porte rendait
// `❌ ① vignettes présentes dans le DOM — 0 vignette(s)`, `❌ ② la région reste correctement
// étiquetée — tabindex=null` et concluait `❌ CARROUSEL NON CONFORME`. **Le produit était
// parfaitement sain** : la table `event` ne comptait aucun événement PASSÉ publié, donc
// `/agenda` n'avait aucune vignette à rendre — *par construction*, et la page omet même la
// section entière (`past.length > 0 ? … : null`).
//
// 🔴 LE MODE DE DÉFAILLANCE EST CELUI, CHIFFRÉ, DE L'EPIC 6 : ~17 instruments faux sur l'epic,
// **tous accusant le produit**. Un développeur pressé « corrige » alors un carrousel qui n'a
// rien. C'est l'action A6 de la rétro Epic 6 (« toute porte qui mesure un service commence par
// vérifier que le service répond ») appliquée aux **DONNÉES** et non au service : ici le
// service répond parfaitement, c'est le jeu de données qui est vide.
//
// ⇒ La porte distingue désormais **« rien à mesurer »** de **« défaut mesuré »**, et le DIT.
// Elle le fait SANS accès à la base, en lisant le contrat que la page publie elle-même :
//   · `/agenda` répond 200 **et** porte la section « À venir »  ⇒ la page a rendu, elle est
//     saine. C'est le cas de vérité connue, LU EN PREMIER (leçon 4.2, parade n°8) ;
//   · la section « Déjà passé » est ABSENTE                     ⇒ aucun événement passé
//     publié : la porte n'a rien à mesurer, elle le DÉCLARE et sort en 0 ;
//   · la section est PRÉSENTE mais ne rend aucune vignette      ⇒ **défaut réel**, elle crie.
// 🔴 ET ELLE EST PROUVÉE **DANS LES DEUX SENS**, sur la page RÉELLE :
//   · elle SE TAIT à zéro — exécution nominale contre staging ;
//   · elle CRIE quand la donnée est censée exister — `CAROUSEL_FORCER_DONNEES=1` fait comme
//     si la section devait être là, et la porte DOIT alors rendre son verdict rouge.
// Une porte qui ne sait pas redevenir verte est une alarme bloquée ; une porte qui ne sait
// plus crier est une décoration.
//
// ⚠️ LE CORRECTIF N'EST **PAS** DE PEUPLER STAGING (arbitrage **A5** de la Story 9.2) : la base
// de staging porte du contenu réel saisi par des administrateurs de l'association, et aucune
// sauvegarde ne tourne (dette R5, Story 7.10).
//
// 🔬 ET LA FAMILLE A ÉTÉ RE-MESURÉE, PARCE QUE R46 LA DISAIT « probablement plus large ».
// **Elle ne l'est pas** — relevé le 2026-08-14 par lecture des trois autres portes qui
// comptent des éléments issus de la base :
//   · `gate:images`   — déclare déjà, PAR PAGE : « aucune image référencée — cette page n'est
//                       donc pas couverte » (l.99-103), et poursuit ;
//   · `gate:lightbox` — déclare déjà : « AUCUNE PHOTO PUBLIÉE : … la lightbox n'a donc pas pu
//                       être éprouvée », et sort en 0 (l.164-173) ;
//   · `gate:marquee`  — déclare déjà : « Si la base ne contient aucun partenaire AVEC LOGO, le
//                       bloc est volontairement absent du DOM — c'est un état légitime, mais
//                       alors cette porte ne peut rien mesurer », et sort en **2** (l.285-294).
//     ⚠️ Le code 2 est CONSERVÉ tel quel : il dit « je n'ai rien pu mesurer », ce qui est
//     exactement la distinction demandée. Le ramener à 0 ferait passer une absence de mesure
//     pour un succès.
// ⇒ `gate:carousel` était la SEULE des quatre à transformer une base vide en réquisitoire.
// Le fait ⑨ de la Story 9.2 est corrigé à la source par cette mesure.
//
// Usage :  node tools/visual-gate/carousel-check.mjs [baseUrl]
//          CAROUSEL_FORCER_DONNEES=1 …  → auto-validation de la sonde de données
import { launchChrome } from "./cdp.mjs";
import { BASE as BASE_DEFAUT } from "./config.mjs";

const BASE = process.argv[2] ?? BASE_DEFAUT;
const URL = BASE + "/agenda";

/**
 * 🔬 AUTO-VALIDATION DE LA SONDE DE DONNÉES (`pieges/instrument-non-valide.md`).
 * Avec `CAROUSEL_FORCER_DONNEES=1`, on fait comme si la section « Déjà passé » devait être
 * rendue. Sur une base sans événement passé, la porte DOIT alors partir mesurer et rendre son
 * verdict ROUGE. Si elle restait verte, c'est que la sonde a désarmé la porte au lieu de la
 * qualifier — et c'est exactement le faux négatif que R46 ne doit pas fabriquer en se
 * corrigeant.
 */
const FORCER_DONNEES = process.env.CAROUSEL_FORCER_DONNEES === "1";

/**
 * Marqueurs de SECTION dans le HTML servi — les `id` que `/agenda` pose sur ses deux `<h2>` et
 * que ses `<section>` référencent en `aria-labelledby`.
 * ⚠️ Garde de NOM et non de contrat (`pieges/garde-nominale.md`), assumée et bornée : ces `id`
 * portent l'accessibilité de la page, donc les supprimer casse le rendu — et Lighthouse le
 * verrait — bien avant de casser cette mesure. Mesurer par nom de classe CSS Module serait
 * PIRE : son hash change à chaque édition du fichier.
 */
const MARQUEUR_PAGE_SAINE = 'id="a-venir-title"';
const MARQUEUR_SECTION_PASSES = 'id="passes-title"';

/**
 * 🔴 L'ANGLE MORT QUE LA SONDE DE DONNÉES **CRÉE**, ET QU'IL FAUT DONC DÉCLARER — trouvé en
 * revue de la Story 9.2, angle données.
 *
 * En corrigeant un faux POSITIF (R46 : une base vide accusait le produit), on ouvre la porte à
 * un faux NÉGATIF : la sonde conclut « rien à mesurer » sur le seul témoignage du RENDU. Si
 * `getPastEvents` régressait un jour — un `lte` devenu `lt`, un filtre `is_published` cassé,
 * une jointure qui vide la liste —, la section disparaîtrait du HTML **exactement comme** à
 * zéro donnée, et cette porte se tairait sur une vraie régression.
 * ⚠️ `CAROUSEL_FORCER_DONNEES=1` ne comble PAS ce trou : il prouve que la porte sait crier sur
 * « 0 vignette », pas que la dérivation SQL est fiable quand elle prétend n'avoir rien à
 * montrer.
 * ⚠️ Et rien d'autre ne le couvre : `gate:agenda` n'écrit **aucun témoin** (mesuré — aucun
 * `insert into event` dans son source), contrairement à la garde ⑭ de `gate:tournois` qui
 * prouve la dérivation des TOURNOIS en committant deux témoins datés de part et d'autre de
 * `now()`.
 * ⇒ Dette **R50**, avec sa story d'absorption nommée. Le correctif est connu : doter
 * `gate:agenda` d'un volet-témoin analogue à la ⑭.
 */
const EXEMPTION_DERIVATION =
  "    ⚠️  EXEMPTION DÉCLARÉE — CETTE SONDE NE COUVRE PAS LA DÉRIVATION SQL ELLE-MÊME.\n" +
  "       « Aucune section passés » est lu sur le RENDU, pas en base : une régression de\n" +
  "       `getPastEvents` produirait le même silence qu'une base sans événement passé.\n" +
  "       Dette R50 → `gate:agenda` doit gagner un volet-témoin comme la ⑭ de gate:tournois.\n";

const sonde = await fetch(URL).catch(() => null);
if (!sonde?.ok) {
  console.error(`\n❌ Rien ne répond correctement sur ${URL} (${sonde?.status ?? "aucune réponse"}).`);
  console.error("   Viser l'hôte réel : GATE_BASE=https://staging.esportdessacres.fr\n");
  process.exit(2);
}

{
  const html = await sonde.text();

  // ① LE CAS DE VÉRITÉ CONNUE D'ABORD : la page a-t-elle rendu ? Sans lui, « section passés
  //    absente » serait indiscernable d'une page en erreur qui ne rend plus rien du tout.
  if (!html.includes(MARQUEUR_PAGE_SAINE)) {
    console.error(`\n❌ ${URL} répond 200 mais ne rend pas la section « À venir ».`);
    console.error("   La page elle-même est en défaut : cette porte ne mesurerait que ça.\n");
    process.exit(2);
  }

  // ② PUIS LA SONDE DE DONNÉES. La page omet ENTIÈREMENT la section « Déjà passé » quand
  //    aucun événement passé n'est publié — c'est son contrat, écrit dans son source.
  const sectionPresente = html.includes(MARQUEUR_SECTION_PASSES);
  if (!sectionPresente && !FORCER_DONNEES) {
    console.log(`\n  Base : ${BASE}`);
    console.log("\n⚠️  GARDE SANS OBJET — ET CE N'EST PAS UN SUCCÈS.");
    console.log(
      "    `/agenda` a rendu correctement, mais elle N'A PAS de section « Déjà passé » : aucun\n" +
        "    événement passé n'est publié en base, donc il n'y a aucune vignette à mesurer —\n" +
        "    par construction, pas par défaut. Le carrousel n'est donc PAS couvert par cette\n" +
        "    exécution : son statut est INCONNU, pas vert.\n",
    );
    console.log(
      "    Pour l'éprouver : publier un événement PASSÉ depuis le back-office (`/admin/agenda`).\n" +
        "    Pour vérifier que cette porte sait encore crier : CAROUSEL_FORCER_DONNEES=1\n",
    );
    console.log(EXEMPTION_DERIVATION);
    process.exit(0);
  }
  if (!sectionPresente && FORCER_DONNEES) {
    console.log(
      "\n  ⚠️  CAROUSEL_FORCER_DONNEES=1 — la section « Déjà passé » est ABSENTE et on mesure\n" +
        "      quand même : un ÉCHEC est ATTENDU. C'est la contre-épreuve de la sonde.\n",
    );
  }
}

const chrome = await launchChrome(9377);
const echecs = [];
const dire = (ok, n, detail) => {
  console.log(`  ${ok ? "✅" : "❌"} ${n} — ${detail}`);
  if (!ok) echecs.push(`${n} (${detail})`);
};

// Sélecteurs par PRÉFIXE de classe CSS Modules : le hash change à chaque édition du
// fichier, le nom du fichier source non (même convention que probe.mjs).
const SEL = {
  viewport: `[class*="PastCarousel-module"][role="group"]`,
  vignette: `li[class*="__vignette"]`,
  boutons: `[class*="PastCarousel-module"] button`,
};

try {
  await chrome.setViewport(1440);
  await chrome.goto(URL);

  const etat0 = await chrome.eval(`(() => {
    const v = document.querySelector(${JSON.stringify(SEL.viewport)});
    const b = Array.from(document.querySelectorAll(${JSON.stringify(SEL.boutons)}));
    return {
      vignettes: document.querySelectorAll(${JSON.stringify(SEL.vignette)}).length,
      trouve: !!v,
      tabindex: v ? v.getAttribute("tabindex") : null,
      label: v ? v.getAttribute("aria-label") : null,
      defilable: v ? v.scrollWidth - v.clientWidth : 0,
      scrollLeft: v ? Math.round(v.scrollLeft) : -1,
      boutons: b.length,
      desactives: b.map((x) => x.disabled),
      libelles: b.map((x) => x.getAttribute("aria-label")),
      liste: !!document.querySelector(${JSON.stringify(SEL.viewport)} + ' ul[role="list"]'),
    };
  })()`);

  // 🔬 LE CONTRAT DÉPEND DU NOMBRE DE VIGNETTES, et c'est volontaire : la production
  // démarrera avec UN SEUL passé (l'équipe n'a pas encore saisi d'historique), état
  // dans lequel un carrousel n'a rien à faire défiler. Un contrôle qui n'exigerait que
  // le cas nominal laisserait passer deux flèches mortes — c'est exactement le défaut
  // qu'il a attrapé.
  const nominal = etat0.vignettes >= 2;
  console.log(`\n  État observé : ${etat0.vignettes} vignette(s) → contrat « ${nominal ? "carrousel" : "vignette unique"} »\n`);

  dire(
    etat0.vignettes >= 1 && etat0.vignettes <= 4,
    "① vignettes présentes dans le DOM, borne de 4 respectée",
    `${etat0.vignettes} vignette(s)`,
  );

  if (!nominal) {
    dire(
      etat0.boutons === 0,
      "① bis vignette unique : AUCUNE flèche (pas de commande morte)",
      `${etat0.boutons} bouton(s)`,
    );
    dire(
      etat0.trouve && etat0.tabindex === "0" && !!etat0.label && etat0.liste,
      "② la région reste correctement étiquetée et la liste sémantique",
      `tabindex=${etat0.tabindex}, ul[role=list]=${etat0.liste}`,
    );
    if (echecs.length === 0) {
      console.log("\n✅ CARROUSEL CONFORME (état à vignette unique) — aucune commande morte.\n");
      await chrome.close();
      process.exit(0);
    }
    console.error("\n❌ CARROUSEL NON CONFORME :\n");
    for (const e of echecs) console.error("   " + e);
    await chrome.close();
    process.exit(1);
  }
  dire(
    etat0.trouve && etat0.tabindex === "0" && !!etat0.label,
    "② région défilante atteignable au clavier",
    `tabindex=${etat0.tabindex}, aria-label=${etat0.label ? "présent" : "ABSENT"}`,
  );
  dire(etat0.liste, "② bis la sémantique de liste survit au role=group", `ul[role=list] imbriqué : ${etat0.liste}`);
  dire(
    etat0.defilable > 0,
    "② bis la région DÉFILE réellement",
    `${etat0.defilable}px de course disponible`,
  );
  dire(etat0.boutons === 2, "③ flèches présentes après hydratation", `${etat0.boutons} bouton(s)`);
  dire(
    etat0.desactives[0] === true && etat0.desactives[1] === false,
    "④ au départ : « plus récent » désactivée, « plus ancien » active",
    JSON.stringify(etat0.desactives),
  );

  // ⑤ Clic réel sur « plus ancien », puis relevé du défilement OBTENU.
  const apresClic = await chrome.eval(
    `(async () => {
      const v = document.querySelector(${JSON.stringify(SEL.viewport)});
      const b = document.querySelectorAll(${JSON.stringify(SEL.boutons)});
      const avant = v.scrollLeft;
      b[1].click();
      await new Promise((r) => setTimeout(r, 700));
      return { avant: Math.round(avant), apres: Math.round(v.scrollLeft) };
    })()`,
    true,
  );
  dire(
    apresClic.apres > apresClic.avant,
    "⑤ un clic fait RÉELLEMENT avancer le défilement",
    `scrollLeft ${apresClic.avant} → ${apresClic.apres}`,
  );

  // ⑥ Aller au bout, puis relever l'état des deux flèches.
  const auBout = await chrome.eval(
    `(async () => {
      const v = document.querySelector(${JSON.stringify(SEL.viewport)});
      v.scrollTo({ left: v.scrollWidth, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 400));
      const b = Array.from(document.querySelectorAll(${JSON.stringify(SEL.boutons)}));
      return { desactives: b.map((x) => x.disabled), scrollLeft: Math.round(v.scrollLeft) };
    })()`,
    true,
  );
  dire(
    auBout.desactives[0] === false && auBout.desactives[1] === true,
    "⑥ au bout : « plus récent » active, « plus ancien » désactivée",
    JSON.stringify(auBout.desactives),
  );
} finally {
  await chrome.close();
}

if (echecs.length === 0) {
  console.log("\n✅ CARROUSEL CONFORME — comportement mesuré, pas déduit du CSS.\n");
  console.log(EXEMPTION_DERIVATION);
  process.exit(0);
}
console.error("\n❌ CARROUSEL NON CONFORME :\n");
for (const e of echecs) console.error("   " + e);
console.error("");
process.exit(1);
