// @porte surface=outillage effet=lecture story=retro-2
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
// La page synthétique ci-dessous porte les défauts que gate.mjs doit voir — ET, depuis
// la Story 3.3, un cas qu'il ne doit PAS signaler (④a) : une exclusion sans preuve de
// non-aveuglement transformerait la porte en décor. Elle ne dépend d'aucun serveur :
// l'auto-test tourne sans build et sans site.
//
// Usage :  pnpm --filter vitrine gate:selftest
import { launchChrome } from "./cdp.mjs";
import { PROBE, STICKY } from "./probe.mjs";

// ① un bloc plus large que le viewport  ② un <header> qui ne colle pas
// ③ un élément dont l'attribut class contient le littéral "undefined"
// ④ (Story 3.3) DEUX conteneurs défilants, et l'instrument doit les DISTINGUER :
//    - `.carrousel-sain`  : défilant, tenant dans le viewport → son contenu large est
//      atteignable d'un geste ⇒ NE DOIT PAS être signalé (faux positif interdit) ;
//    - `.carrousel-malade`: défilant MAIS débordant lui-même de l'écran ⇒ DOIT rester
//      signalé. Sans ce second cas, l'exclusion serait une porte dérobée : il aurait
//      suffi d'écrire `overflow-x: auto` pour faire taire la porte sur tout un sous-arbre.
const PAGE_MALADE = `
<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { overflow-x: clip; }           /* comme globals.css : rogne EN SILENCE */
  header { position: static; height: 60px; background: #333; }  /* ② PAS sticky */
  .large { width: 3000px; height: 40px; background: #c33; }     /* ① déborde */
  .long { height: 4000px; }                  /* de quoi défiler */
  .carrousel-sain { overflow-x: auto; width: 600px; white-space: nowrap; }
  .carrousel-malade { overflow-x: auto; width: 1200px; white-space: nowrap; }
  .piste { width: 2400px; }
  /* ⑤ — R38 : la BOITE ne grandit pas, c'est le TEXTE qui deborde d'elle. */
  .boite-etroite { width: 120px; }
  /* Temoin NEGATIF : meme mot, meme boite, mais la parade est posee. */
  .boite-etroite-gardee { width: 120px; overflow-wrap: anywhere; }
</style></head><body>
  <header>en-tete</header>
  <main id="content">
    <div class="large">bloc trop large</div>
    <div class="undefined">classe fantome</div>   <!-- ③ -->
    <div class="carrousel-sain"><div class="piste">contenu large mais ATTEIGNABLE</div></div>
    <div class="carrousel-malade"><div class="piste">contenu large et conteneur hors ecran</div></div>
    <p class="boite-etroite">MOTINSECABLEQUIDEBORDEDESAPROPREBOITE</p>
    <p class="boite-etroite-gardee">MOTINSECABLEMAISGARDEPARLAPARADEANYWHERE</p>
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
    {
      // Le contenu du carrousel SAIN ne doit apparaître dans AUCUN débordement…
      n: "④a conteneur défilant sain — pas de faux positif",
      vu:
        d.overflow.exclusDefilant >= 1 &&
        !d.overflow.debordements.some((b) => /ATTEIGNABLE/.test(b.texte)),
      detail:
        `${d.overflow.exclusDefilant} élément(s) excusé(s) par un conteneur défilant sain ; ` +
        `« ATTEIGNABLE » signalé : ${d.overflow.debordements.some((b) => /ATTEIGNABLE/.test(b.texte))}`,
    },
    {
      // …mais l'exclusion ne doit PAS s'étendre à un conteneur qui déborde lui-même.
      n: "④b conteneur défilant hors écran — toujours signalé",
      vu: d.overflow.debordements.some((b) => /hors ecran/.test(b.texte)),
      detail: `signalé : ${d.overflow.debordements.some((b) => /hors ecran/.test(b.texte))}`,
    },
    {
      // ⑤ R38 — le TEXTE deborde de sa propre boite, la boite ne bouge pas.
      n: "⑤a debordement de TEXTE dans sa boite",
      vu: d.overflow.debordementsTexte.some((t) => /MOTINSECABLEQUI/.test(t.texte)),
      detail:
        `${d.overflow.debordementsTexte.length} debordement(s) de texte vu(s)` +
        (d.overflow.debordementsTexte[0]
          ? ` — boite ${d.overflow.debordementsTexte[0].boite}px / contenu ${d.overflow.debordementsTexte[0].contenu}px`
          : ""),
    },
    {
      // ⑤b — CONTRE-EPREUVE : la parade `overflow-wrap: anywhere` doit faire TAIRE
      // le detecteur. Sans ce cas, un detecteur qui signalerait TOUT passerait ⑤a.
      n: "⑤b la parade `overflow-wrap: anywhere` fait taire le detecteur",
      vu: !d.overflow.debordementsTexte.some((t) => /MOTINSECABLEMAIS/.test(t.texte)),
      detail: `signale a tort : ${d.overflow.debordementsTexte.some((t) => /MOTINSECABLEMAIS/.test(t.texte))}`,
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
    "\n✅ INSTRUMENT VALIDE — les détecteurs voient les défauts d'une page qui les porte.",
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
