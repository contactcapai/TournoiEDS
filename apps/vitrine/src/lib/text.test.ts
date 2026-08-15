import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanText, neutraliserInvisibles, truncate, visiblementVide } from "./text";

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
    for (const v of ["\u200B", "\u00AD\u00AD", "\uFEFF", " \u200B \u200C "]) {
      assert.equal(cleanText(v), null, JSON.stringify(v));
    }
  });

  it("laisse passer un vrai texte, et un emoji à ZWJ SURVIT", () => {
    assert.equal(cleanText("  Jeudi LAN  "), "Jeudi LAN");
    // 👨\u200D👩\u200D👧 est assemblé par des U+200D : le retirer casserait l'emoji.
    assert.equal(cleanText("👨\u200D👩\u200D👧"), "👨\u200D👩\u200D👧");
  });

  it("visiblementVide distingue le vide réel du vide invisible", () => {
    assert.equal(visiblementVide("\u200B\u200B"), true);
    assert.equal(visiblementVide("a"), false);
  });
});

// Dette R41 : un invisible COLLÉ à une valeur visible traversait Zod et tous les CHECK.
// Sur contact_email, c'est le `to:` d'un SMTP — donc un e-mail jamais délivré, en silence.
describe("neutraliserInvisibles", () => {
  it("retire un invisible collé à une valeur visible", () => {
    assert.equal(neutraliserInvisibles("a@b.fr\u200B"), "a@b.fr");
    assert.equal(neutraliserInvisibles("\u200Ba@b.fr"), "a@b.fr");
    assert.equal(neutraliserInvisibles("https://exemple.fr\u00AD"), "https://exemple.fr");
    assert.equal(neutraliserInvisibles("Le\uFEFF Cheval Blanc"), "Le Cheval Blanc");
  });

  it("laisse SURVIVRE les invisibles porteurs de sens", () => {
    // U+200D (ZWJ) assemble les emojis ; U+200C (ZWNJ) sert dans plusieurs écritures.
    assert.equal(neutraliserInvisibles("👨\u200D👩\u200D👧"), "👨\u200D👩\u200D👧");
    assert.equal(neutraliserInvisibles("a\u200Cb"), "a\u200Cb");
  });

  it("expose et retire un espace devenu terminal", () => {
    assert.equal(neutraliserInvisibles("a \u200B"), "a");
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
