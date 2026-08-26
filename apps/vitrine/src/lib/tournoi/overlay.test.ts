import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { estTransparent, heureDeFraicheur } from "./overlay";

describe("le fond transparent des overlays OBS (Story 10.6)", () => {
  it("accepte `1`, et rien d'autre — le contrat de l'ancienne app, repris tel quel", () => {
    assert.equal(estTransparent("1"), true);
    assert.equal(estTransparent("0"), false);
    assert.equal(estTransparent(undefined), false);
    // Élargir à `true`/`on`/`oui` élargirait un contrat que personne n'a demandé d'élargir,
    // et les URLs notées dans les fiches du caster ne diraient plus tout à fait la même chose.
    assert.equal(estTransparent("true"), false);
  });

  it("🔴 supporte un paramètre RÉPÉTÉ — sinon le fond reste opaque à l'antenne, sans erreur", () => {
    // Next rend un TABLEAU quand un paramètre apparaît deux fois. Sans le garde, la comparaison
    // porterait sur un tableau et rendrait toujours `false` : le chroma key n'aurait rien à
    // découper, et rien à l'écran ne dirait pourquoi.
    assert.equal(estTransparent(["1"]), true);
    assert.equal(estTransparent(["1", "0"]), true);
    assert.equal(estTransparent([]), false);
  });
});

describe("le témoin de fraîcheur — celui qui paie l'abandon du socket", () => {
  it("🔴 affiche l'heure de PARIS, pas celle du process — le conteneur tourne en UTC", () => {
    // 12:34:56 UTC en été = 14:34:56 à Paris. Sans `timeZone`, l'overlay afficherait 12:34:56
    // sur le VPS : le caster croirait le témoin figé de deux heures, donc l'incrustation morte.
    // Juste en local (poste à Paris), faux en production, sans erreur ni test rouge.
    const instant = new Date("2026-08-26T12:34:56.000Z");
    assert.equal(heureDeFraicheur(instant), "14:34:56");
  });

  it("tient aussi en heure d'hiver (décalage +1, pas +2)", () => {
    assert.equal(heureDeFraicheur(new Date("2026-01-15T12:34:56.000Z")), "13:34:56");
  });

  it("⚠️ porte les SECONDES : à 10 s de rythme, sans elles le témoin semblerait figé une minute", () => {
    // Un témoin qui accuse à tort est pire qu'aucun témoin — on apprend à ne plus le regarder.
    assert.match(heureDeFraicheur(new Date("2026-08-26T12:34:56.000Z")), /^\d{2}:\d{2}:\d{2}$/);
  });
});
