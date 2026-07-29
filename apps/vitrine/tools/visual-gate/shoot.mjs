// Captures pleine page — Story 2.10.
// La mesure de géométrie ne voit PAS les couleurs : une perte de `background`
// seule y serait invisible. La capture, elle, prouve « aucun changement visuel »
// au sens littéral. C'est la preuve objective de la moitié A ; le gate visuel de
// Brice la confirme, il ne la remplace pas (et réciproquement).
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { launchChrome } from "./cdp.mjs";

const BASE = process.argv[2];
const OUTDIR = process.argv[3];
const PAGES = ["/", "/l-asso", "/animations"];
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
