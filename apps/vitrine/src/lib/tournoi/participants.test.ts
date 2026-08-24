import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { participantsDepuisLeClassement } from "./participants";

/**
 * Qui entre dans une manche suisse (2026-08-24).
 *
 * 🔴 LES DEUX PREMIERS CAS SONT DES DÉFAUTS RÉELS DU CODE D'AVANT, et aucun ne se voyait :
 * un présent jamais classé était OUBLIÉ de toutes les manches, et un absent déjà classé était
 * REPLACÉ à chaque manche. Le premier ne laisse aucune trace ; le second se remarque à une
 * table qui joue à sept en attendant quelqu'un qui ne viendra pas.
 *
 * ⚠️ Ils sont ici pour qu'on ne réécrive jamais « on part du classement, filtré sur les
 * abandons » : c'est le classement qui donne l'ORDRE, et le pointage qui donne QUI.
 */

const classe = (id: string) => ({ id, nom: id });

describe("participantsDepuisLeClassement", () => {
  it("🔴 fait entrer un présent qui n'a JAMAIS joué, en queue de classement", () => {
    // Le cas du week-end 2 : quelqu'un arrive, il n'a aucun résultat. L'ancien code
    // l'oubliait purement et simplement.
    const retenus = participantsDepuisLeClassement(
      [classe("alice"), classe("bob")],
      [classe("alice"), classe("bob"), classe("nouveau")],
    );
    assert.deepEqual(
      retenus.map((e) => e.id),
      ["alice", "bob", "nouveau"],
      "un présent sans résultat entre APRÈS les classés, jamais nulle part",
    );
  });

  it("🔴 ne fait PAS entrer un classé qui n'est plus présent", () => {
    // Le cas de l'absent : il a joué le premier week-end, il n'est pas revenu. L'ancien code
    // ne retirait que les abandons, donc il gardait une chaise.
    const retenus = participantsDepuisLeClassement(
      [classe("alice"), classe("parti"), classe("bob")],
      [classe("alice"), classe("bob")],
    );
    assert.deepEqual(
      retenus.map((e) => e.id),
      ["alice", "bob"],
      "ses points restent au classement, sa chaise ne lui est plus réservée",
    );
  });

  it("respecte l'ordre du classement — c'est ce qui met les meilleurs ensemble", () => {
    const retenus = participantsDepuisLeClassement(
      [classe("premier"), classe("deuxieme"), classe("troisieme")],
      // Volontairement dans un autre ordre : c'est le CLASSEMENT qui ordonne, pas le pointage.
      [classe("troisieme"), classe("premier"), classe("deuxieme")],
    );
    assert.deepEqual(
      retenus.map((e) => e.id),
      ["premier", "deuxieme", "troisieme"],
    );
  });

  it("garde l'ordre d'arrivée entre les non-classés", () => {
    const retenus = participantsDepuisLeClassement(
      [classe("alice")],
      [classe("alice"), classe("zoe"), classe("bob")],
    );
    assert.deepEqual(
      retenus.map((e) => e.id),
      ["alice", "zoe", "bob"],
      "aucun tri par nom : on ne réordonne pas ce qu'on ne sait pas départager",
    );
  });

  it("ne fait entrer personne deux fois, même si le classement le répète", () => {
    const retenus = participantsDepuisLeClassement(
      [classe("alice"), classe("alice"), classe("bob")],
      [classe("alice"), classe("bob")],
    );
    assert.deepEqual(retenus.map((e) => e.id), ["alice", "bob"]);
  });

  it("rend une liste vide quand personne n'est pointé — et le dit en rendant vide", () => {
    assert.deepEqual(participantsDepuisLeClassement([classe("alice")], []), []);
  });

  it("rend tous les présents quand aucun classement n'existe encore", () => {
    const retenus = participantsDepuisLeClassement([], [classe("alice"), classe("bob")]);
    assert.deepEqual(retenus.map((e) => e.id), ["alice", "bob"]);
  });
});
