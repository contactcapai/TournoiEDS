import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { IDENTIFIANT_JEU_MAX, PSEUDO_MAX, profilSaisi } from "./profil";

const saisir = (o: Record<string, string>) =>
  profilSaisi.safeParse({
    pseudo: "",
    discordPseudo: "",
    riotId: "",
    steamId: "",
    epicId: "",
    ...o,
  });

describe("profil saisi — un champ vidé doit redevenir ABSENT (Story 12.1)", () => {
  it("🔴 une chaîne vide rend `undefined`, jamais `\"\"`", () => {
    // C'est LA règle muette : un `""` en base passerait les `CHECK` (ils ne se prononcent que
    // sur les lignes non nulles), et l'écran afficherait un pseudo vide au lieu de dire
    // « non renseigné ». Côté action, `undefined` est ensuite converti en `null` — sans quoi
    // Drizzle OMETTRAIT la colonne et l'ancienne valeur resterait.
    const analyse = saisir({});
    assert.equal(analyse.success, true);
    assert.deepEqual(analyse.data, {
      pseudo: undefined,
      discordPseudo: undefined,
      riotId: undefined,
      steamId: undefined,
      epicId: undefined,
    });
  });

  it("un champ fait UNIQUEMENT d'espaces compte comme absent", () => {
    const analyse = saisir({ pseudo: "   " });
    assert.equal(analyse.success && analyse.data.pseudo, undefined);
  });

  it("🔴 un champ fait de caractères INVISIBLES compte comme absent (dette R41)", () => {
    // `btrim` ne retire pas U+200B : sans `texteNettoye`, ce pseudo passerait les `CHECK` et
    // s'afficherait comme un blanc que personne ne saurait effacer.
    const analyse = saisir({ pseudo: "\u200b\u200b" });
    assert.equal(analyse.success && analyse.data.pseudo, undefined);
  });

  it("une valeur réelle traverse, débarrassée de ses bords", () => {
    const analyse = saisir({ riotId: "  ClaraByte#EUW  " });
    assert.equal(analyse.success && analyse.data.riotId, "ClaraByte#EUW");
  });
});

describe("profil saisi — les bornes sont des gardes de saisie", () => {
  it("refuse un pseudo trop long", () => {
    assert.equal(saisir({ pseudo: "a".repeat(PSEUDO_MAX + 1) }).success, false);
    assert.equal(saisir({ pseudo: "a".repeat(PSEUDO_MAX) }).success, true);
  });

  it("refuse un identifiant de jeu trop long", () => {
    assert.equal(saisir({ steamId: "a".repeat(IDENTIFIANT_JEU_MAX + 1) }).success, false);
  });

  it("⚠️ n'impose AUCUN format : Riot, Steam et Epic n'en partagent pas", () => {
    // Une regex refuserait un identifiant VALIDE le jour où une plateforme change sa forme —
    // et le refus tomberait sur la personne, pas sur nous.
    for (const valeur of ["Clara#EUW", "76561198000000000", "clara_byte", "Clara Byte"]) {
      assert.equal(saisir({ riotId: valeur }).success, true, valeur);
    }
  });
});
