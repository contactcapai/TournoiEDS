// Captures pleine page — Story 2.10.
// La mesure de géométrie ne voit PAS les couleurs : une perte de `background`
// seule y serait invisible. La capture, elle, prouve « aucun changement visuel »
// au sens littéral. C'est la preuve objective de la moitié A ; le gate visuel de
// Brice la confirme, il ne la remplace pas (et réciproquement).
// ⚠️ CORRIGÉ EN STORY 5.5 — les pages étaient écrites EN DUR ici (`/`, `/l-asso`,
// `/animations`, l'état du site à la Story 2.10) et n'ont jamais suivi l'ajout
// d'`/agenda` (3.3) ni de `/partenaires` (4.2). Un refactor transverse « prouvé
// invisible » sur 3 pages ne prouvait donc RIEN sur les 2 autres, EN SILENCE —
// exactement le mode de défaillance que l'en-tête de `config.mjs` avertit. La
// liste vient désormais de la SOURCE UNIQUE, comme pour toutes les autres portes.
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { launchChrome } from "./cdp.mjs";
import { PAGES } from "./config.mjs";

const BASE = process.argv[2];
const OUTDIR = process.argv[3];
// Sous-ensemble des 7 largeurs de référence : la plus tendue, le breakpoint, le
// desktop courant. Trois suffisent ici — la capture prouve l'absence de changement
// VISUEL, pas la conformité de mise en page (c'est le rôle de `gate`, qui, lui,
// balaie les 7).
const WIDTHS = [320, 880, 1440];

mkdirSync(OUTDIR, { recursive: true });
const chrome = await launchChrome(9355);
// Même émulation que measure.mjs : sans elle, les animations d'entrée rendent
// deux captures du MÊME code différentes.
await chrome.setEmulatedMedia({ "prefers-reduced-motion": "reduce" });

const hashes = {};
try {
  for (const page of PAGES) {
    for (const width of WIDTHS) {
      await chrome.setViewport(width);
      await chrome.goto(BASE + page);
      const png = await chrome.captureFullPage();
      const name = `${page.replace(/\//g, "_") || "_home"}-${width}.png`;
      writeFileSync(`${OUTDIR}/${name}`, Buffer.from(png, "base64"));
      hashes[name] = createHash("sha256").update(Buffer.from(png, "base64")).digest("hex").slice(0, 16);
    }
  }
} finally {
  await chrome.close();
}

writeFileSync(`${OUTDIR}/hashes.json`, JSON.stringify(hashes, null, 1));
for (const [k, v] of Object.entries(hashes)) console.log(`${v}  ${k}`);
