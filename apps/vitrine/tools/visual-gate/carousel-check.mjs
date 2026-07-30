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
// Usage :  node tools/visual-gate/carousel-check.mjs [baseUrl]
import { launchChrome } from "./cdp.mjs";
import { BASE as BASE_DEFAUT } from "./config.mjs";

const BASE = process.argv[2] ?? BASE_DEFAUT;
const URL = BASE + "/agenda";

const sonde = await fetch(URL).catch(() => null);
if (!sonde?.ok) {
  console.error(`\n❌ Rien ne répond correctement sur ${URL}.`);
  console.error("   Lancer : pnpm --filter vitrine build && pnpm --filter vitrine start\n");
  process.exit(2);
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
  process.exit(0);
}
console.error("\n❌ CARROUSEL NON CONFORME :\n");
for (const e of echecs) console.error("   " + e);
console.error("");
process.exit(1);
