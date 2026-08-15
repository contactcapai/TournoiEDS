import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanText, truncate, visiblementVide } from "./text";

// Ce que l'œil ne peut PAS voir : des caractères invisibles qui font passer un champ
// vide pour un champ rempli. C'est le seul motif de ce module qui mérite un test.
describe("cleanText", () => {
  it("ramène le vide, le blanc et l'absence à null", () => {
    for (const v of [null, undefined, "", "   ", "\n\t "]) {
      assert.equal(cleanText(v), null);
    }
  });

  it("ramène les caractères SANS LARGEUR à null", () => {
    // U+200B espace de largeur nulle, U+00AD trait d'union conditionnel, U+FEFF BOM.
    // `.trim()` seul ne les retire pas : le champ ressortait « rempli » et vide à l'écran.
    for (const v of ["​", "­­", "﻿", " ​ ‌ "]) {
      assert.equal(cleanText(v), null, JSON.stringify(v));
    }
  });

  it("laisse passer un vrai texte, et un emoji à ZWJ SURVIT", () => {
    assert.equal(cleanText("  Jeudi LAN  "), "Jeudi LAN");
    // 👨‍👩‍👧 est assemblé par des U+200D : le retirer casserait l'emoji.
    assert.equal(cleanText("👨‍👩‍👧"), "👨‍👩‍👧");
  });

  it("visiblementVide distingue le vide réel du vide invisible", () => {
    assert.equal(visiblementVide("​​"), true);
    assert.equal(visiblementVide("a"), false);
  });
});

describe("truncate", () => {
  it("ne coupe jamais au milieu d'un caractère", () => {
    // Découpe par points de code : `slice()` produirait un demi-substitut orphelin.
    const r = truncate("AAAAAAAAAA🎮BBBBBBBBBB", 11);
    assert.ok(r && !/[\uD800-\uDBFF]$/.test(r.replace("…", "")), `orphelin dans ${r}`);
  });

  it("rend le texte intact s'il tient dans la borne", () => {
    assert.equal(truncate("court", 20), "court");
  });
});
