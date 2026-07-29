// 🔬 AUTO-TEST DE L'INSTRUMENT — prouve que les trois détecteurs SAVENT ÉCHOUER.
//
// Sans lui, un « ✅ PORTE VERTE » est ambigu : le site est-il sain, ou le détecteur
// est-il aveugle ? C'est la parade n°4 de `00 référence/pieges/instrument-non-valide.md`
// (« exiger que l'instrument sache échouer »), appliquée à l'outil lui-même — la même
// idée que la preuve RED d'un test.
//
// Ce n'est pas théorique : en Story 2.10, l'instrument a été FAUX TROIS FOIS avant de
// servir de porte (prédicat trop large qui attrapait 4 tuiles de pied de page pour des
// liens fléchés ; compteur de nœuds non déterministe ; bruit d'animation à 0,65px).
//
// La page synthétique ci-dessous porte les TROIS défauts que gate.mjs doit voir. Elle
// ne dépend d'aucun serveur : l'auto-test tourne sans build et sans site.
//
// Usage :  pnpm --filter vitrine gate:selftest
import { launchChrome } from "./cdp.mjs";
import { PROBE, STICKY } from "./probe.mjs";

// ① un bloc plus large que le viewport  ② un <header> qui ne colle pas
// ③ un élément dont l'attribut class contient le littéral "undefined"
const PAGE_MALADE = `
<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { overflow-x: clip; }           /* comme globals.css : rogne EN SILENCE */
  header { position: static; height: 60px; background: #333; }  /* ② PAS sticky */
  .large { width: 3000px; height: 40px; background: #c33; }     /* ① déborde */
  .long { height: 4000px; }                  /* de quoi défiler */
</style></head><body>
  <header>en-tete</header>
  <main id="content">
    <div class="large">bloc trop large</div>
    <div class="undefined">classe fantome</div>   <!-- ③ -->
    <div class="long"></div>
  </main>
  <footer>pied</footer>
</body></html>`;

const chrome = await launchChrome(9366);
const echecs = [];

try {
  await chrome.setEmulatedMedia({ "prefers-reduced-motion": "reduce" });
  await chrome.setViewport(800);
  await chrome.goto(
    "data:text/html;charset=utf-8," + encodeURIComponent(PAGE_MALADE),
  );

  const d = await chrome.eval(PROBE);
  const s = await chrome.eval(STICKY, true);

  const attendus = [
    {
      n: "① débordement horizontal",
      vu: d.overflow.ok === false && d.overflow.debordements.length >= 1,
      detail:
        `${d.overflow.debordements.length} débordement(s) vu(s) ; ` +
        `⚠️ scrollWidth vaut ${d.overflow.scrollWidthInforme} pour un viewport de ` +
        `${d.overflow.viewportWidth}px — c'est précisément pourquoi il ne peut PAS ` +
        `servir de témoin sous overflow-x: clip`,
    },
    {
      n: "② header non sticky",
      vu: s.found === true && s.sticky === false,
      detail: `trouvé=${s.found}, top après défilement=${s.topAfterScroll}px`,
    },
    {
      n: "③ classe fantôme",
      vu: d.phantomClasses.length === 1,
      detail: `${d.phantomClasses.length} détectée(s)`,
    },
  ];

  for (const a of attendus) {
    console.log(`  ${a.vu ? "✅" : "❌"} ${a.n} — ${a.detail}`);
    if (!a.vu) {
      echecs.push(
        `${a.n} : le détecteur N'A PAS VU un défaut pourtant présent (${a.detail})`,
      );
    }
  }
} finally {
  await chrome.close();
}

if (echecs.length === 0) {
  console.log(
    "\n✅ INSTRUMENT VALIDE — les 3 détecteurs voient les 3 défauts d'une page qui les porte.",
  );
  console.log("   Un « PORTE VERTE » de gate.mjs a donc du contenu.\n");
  process.exit(0);
}

console.error("\n❌ INSTRUMENT AVEUGLE :\n");
for (const e of echecs) console.error("   " + e);
console.error(
  "\n⚠️ Tant que ceci échoue, un « ✅ PORTE VERTE » de gate.mjs NE PROUVE RIEN.\n",
);
process.exit(1);
