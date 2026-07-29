// Comparaison STRICTE de deux snapshots — porte de la moitié A (Story 2.10, AC1/AC3).
//
// `wrapSources` est EXCLU de la comparaison : c'est la liste des fichiers sources
// qui déclarent un conteneur central, et elle DOIT changer (c'est le livrable de
// l'AC2). Elle est rapportée à part. Tout le reste doit être identique au pixel.
import { readFileSync } from "node:fs";

const [fileA, fileB] = process.argv.slice(2);
const A = JSON.parse(readFileSync(fileA, "utf8"));
const B = JSON.parse(readFileSync(fileB, "utf8"));

const diffs = [];
const note = (where, what, a, b) => diffs.push({ where, what, a, b });

const cmpList = (where, kind, la, lb, keys) => {
  if (la.length !== lb.length) {
    note(where, `${kind}: NOMBRE`, la.length, lb.length);
    return;
  }
  for (let i = 0; i < la.length; i++) {
    for (const k of keys) {
      const va = JSON.stringify(la[i][k]);
      const vb = JSON.stringify(lb[i][k]);
      if (va !== vb) note(where, `${kind}[${i}].${k} (${la[i].path ?? ""})`, va, vb);
    }
  }
};

for (const page of Object.keys(A.pages)) {
  for (const width of Object.keys(A.pages[page])) {
    const a = A.pages[page][width];
    const b = B.pages[page]?.[width];
    const where = `${page} @${width}px`;
    if (!b) { note(where, "PAGE/LARGEUR ABSENTE", "présente", "absente"); continue; }

    // ① Conteneurs centraux : géométrie + boîte, PAS la classe (elle change)
    cmpList(where, "wrap", a.wraps, b.wraps,
      ["path", "tag", "rect", "maxWidth", "ml", "mr", "pl", "pr", "position", "zIndex"]);

    // ② Titres, ③ LinkArrow, ④ Button outline
    cmpList(where, "heading", a.headings, b.headings,
      ["path", "tag", "text", "fontWeight", "fontFamily", "fontSize", "rect"]);
    cmpList(where, "linkArrow", a.linkArrows, b.linkArrows,
      ["path", "text", "rect", "minHeight", "pt", "pb", "display"]);
    cmpList(where, "outline", a.outlines, b.outlines,
      ["path", "text", "borderColor", "borderWidth", "rect"]);

    // ⑤ Débordement, ⑥ texte, ⑦ motif 2.8, ⑧ structure
    if (a.overflow.ok !== b.overflow.ok || a.overflow.scrollWidth !== b.overflow.scrollWidth)
      note(where, "overflow", JSON.stringify(a.overflow), JSON.stringify(b.overflow));
    if (a.mainText !== b.mainText) {
      let i = 0;
      while (i < a.mainText.length && a.mainText[i] === b.mainText[i]) i++;
      note(where, `TEXTE du <main> (1er écart à l'index ${i})`,
        "…" + a.mainText.slice(Math.max(0, i - 40), i + 40) + "…",
        "…" + b.mainText.slice(Math.max(0, i - 40), i + 40) + "…");
    }
    if (a.revealCount !== b.revealCount) note(where, "sections .reveal", a.revealCount, b.revealCount);
    if (JSON.stringify(a.domNodes) !== JSON.stringify(b.domNodes))
      note(where, "nœuds header/main/footer", JSON.stringify(a.domNodes), JSON.stringify(b.domNodes));
    if (a.sticky.sticky !== b.sticky.sticky)
      note(where, "header sticky", a.sticky.sticky, b.sticky.sticky);
  }
}

const p = (s) => process.stdout.write(s + "\n");
p(`\n╔═ COMPARAISON ${A.at || fileA}  →  ${B.at || fileB}`);

// Changement ATTENDU, rapporté à part
p("╠═ Sources déclarant un conteneur central (changement ATTENDU, AC2) :");
for (const page of Object.keys(A.pages)) {
  const sa = A.pages[page][1440].wrapSources.join(", ");
  const sb = B.pages[page]?.[1440]?.wrapSources.join(", ") ?? "—";
  p(`║   ${page.padEnd(12)} avant : ${sa}`);
  p(`║   ${"".padEnd(12)} après : ${sb}`);
}

p("╠═ Écarts sur tout le reste (attendu : AUCUN) :");
if (diffs.length === 0) {
  const combos = Object.keys(A.pages).length * Object.keys(A.pages[Object.keys(A.pages)[0]]).length;
  p(`║   ✅ 0 écart sur ${combos} combinaisons page × largeur.`);
} else {
  p(`║   ❌ ${diffs.length} écart(s) :`);
  for (const d of diffs.slice(0, 40)) {
    p(`║   • ${d.where} — ${d.what}`);
    p(`║       avant : ${d.a}`);
    p(`║       après : ${d.b}`);
  }
  if (diffs.length > 40) p(`║   … et ${diffs.length - 40} de plus`);
}
p("╚═");
process.exit(diffs.length === 0 ? 0 : 1);
