// Mesure de référence / de contrôle — Story 2.10.
//
// L'identité des éléments est un CHEMIN DOM (indices d'enfants), pas un nom de
// classe : les noms de classes CSS Modules changent par construction pendant ce
// refactor, le chemin non. Un chemin qui change EST un ajout/retrait de nœud DOM,
// donc une violation de l'AC2 — l'instrument le détecte au lieu de le masquer.
//
// Les conteneurs centraux sont identifiés par un INVARIANT (`max-width` calculé
// = 1160px), seul usage de --wrap-max dans le site, et non par leur classe.
import { writeFileSync } from "node:fs";
import { launchChrome } from "./cdp.mjs";
import { PROBE, STICKY } from "./probe.mjs";

const BASE = process.argv[2] ?? process.env.GATE_BASE ?? "http://127.0.0.1:4310";
const OUT = process.argv[3] ?? "snapshot.json";

import { PAGES, WIDTHS } from "./config.mjs";


// Header sticky : scroller PUIS relever la position réelle (garde comportementale,
// pas nominale — `position: sticky` dans le CSS ne prouve rien, leçon R19).

const chrome = await launchChrome();

// 🔬 `prefers-reduced-motion: reduce` ÉMULÉ pendant toute la mesure — ce n'est pas
// un détail de confort, c'est ce qui rend l'instrument DÉTERMINISTE.
//
// Sans ça, mesuré sur DEUX exécutions du MÊME code : le <h1> du Hero et son
// LinkArrow se décalaient de ~0,65px en y, et tout ce qui suit avec. Cause :
// `hero-rise` (Story 2.1, translateY(14px) -> none) était ENCORE EN VOL au moment
// du relevé, et `getBoundingClientRect()` inclut les transforms. Le `sticker-pulse`
// est en plus `infinite`, donc jamais « terminé ».
//
// Sous `reduce`, le site ne DÉCLARE aucune de ces animations (patron Hero 2.1 et
// motion.module.css 2.8 : tout vit sous `no-preference`) — la géométrie relevée est
// donc l'état final, stable. Les deux snapshots comparés utilisent la même émulation,
// et la géométrie au repos y est identique à celle de l'état animé une fois terminé.
await chrome.setEmulatedMedia({ "prefers-reduced-motion": "reduce" });

const snapshot = { base: BASE, at: process.env.SNAPSHOT_LABEL ?? "",
  emulated: "prefers-reduced-motion: reduce", pages: {} };

try {
  for (const page of PAGES) {
    snapshot.pages[page] = {};
    for (const width of WIDTHS) {
      await chrome.setViewport(width);
      await chrome.goto(BASE + page);
      const data = await chrome.eval(PROBE);
      const sticky = await chrome.eval(STICKY, true);
      snapshot.pages[page][width] = { ...data, sticky };
    }
  }
} finally {
  await chrome.close();
}

writeFileSync(OUT, JSON.stringify(snapshot, null, 1));

// ── Résumé lisible ──────────────────────────────────────────────────────────
const p = (s) => process.stdout.write(s + "\n");
p(`\nSnapshot écrit : ${OUT}`);
for (const page of PAGES) {
  const at1440 = snapshot.pages[page][1440];
  const widths = WIDTHS.map((w) => snapshot.pages[page][w]);
  p(`\n── ${page}`);
  p(`   conteneurs centraux ...... ${at1440.wraps.length} (à 1440px)`);
  p(`   déclarés par ............. ${at1440.wrapSources.join(", ")}`);
  p(`   titres <hN> .............. ${at1440.headings.length}`);
  p(`   LinkArrow ................ ${at1440.linkArrows.length}`);
  p(`   Button outline ........... ${at1440.outlines.length}`);
  p(`   sections .reveal ......... ${at1440.revealCount}`);
  const ph = widths.reduce((n, w) => n + w.phantomClasses.length, 0);
  p(`   classes FANTÔMES ......... ${ph === 0 ? "0 ✅" : `${ph} ❌ ` + JSON.stringify(at1440.phantomClasses)}`);
  p(`   nœuds header/main/footer . ${at1440.domNodes.header}/${at1440.domNodes.main}/${at1440.domNodes.footer}`);
  p(`   scrollWidth === clientWidth : ${widths.filter((w) => w.overflow.ok).length}/${WIDTHS.length}`);
  p(`   header sticky (top === 0) .. ${widths.filter((w) => w.sticky.sticky).length}/${WIDTHS.length}`);
  const fw = [...new Set(at1440.headings.map((h) => h.fontWeight))].sort();
  p(`   font-weight des titres ..... ${fw.join(", ")}`);
  const la = at1440.linkArrows.map((l) => `${l.rect.w}×${l.rect.h}`);
  p(`   boîtes LinkArrow ........... ${la.join("  ") || "—"}`);
  const ol = at1440.outlines.map((o) => o.borderColor);
  p(`   bord outline ............... ${ol.join("  ") || "—"}`);
}
