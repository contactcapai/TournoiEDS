import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateRandomLobbies } from "./lobbyGenerator";

function makePlayerIds(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i + 1);
}

describe("generateRandomLobbies", () => {
  it("32 joueurs → 4 lobbies de 8", () => {
    const ids = makePlayerIds(32);
    const lobbies = generateRandomLobbies(ids);
    assert.equal(lobbies.length, 4);
    for (const lobby of lobbies) {
      assert.equal(lobby.length, 8);
    }
    const flat = lobbies.flat().sort((a, b) => a - b);
    assert.deepEqual(flat, ids);
  });

  it("28 joueurs → 3 lobbies de 8 + 1 lobby de 4", () => {
    const ids = makePlayerIds(28);
    const lobbies = generateRandomLobbies(ids);
    assert.equal(lobbies.length, 4);
    const sizes = lobbies.map((l) => l.length).sort((a, b) => b - a);
    assert.deepEqual(sizes, [8, 8, 8, 4]);
    const flat = lobbies.flat().sort((a, b) => a - b);
    assert.deepEqual(flat, ids);
  });

  it("15 joueurs → 1 lobby de 8 + 1 lobby de 7", () => {
    const ids = makePlayerIds(15);
    const lobbies = generateRandomLobbies(ids);
    assert.equal(lobbies.length, 2);
    const sizes = lobbies.map((l) => l.length).sort((a, b) => b - a);
    assert.deepEqual(sizes, [8, 7]);
    const flat = lobbies.flat().sort((a, b) => a - b);
    assert.deepEqual(flat, ids);
  });

  it("8 joueurs → 1 lobby de 8", () => {
    const ids = makePlayerIds(8);
    const lobbies = generateRandomLobbies(ids);
    assert.equal(lobbies.length, 1);
    assert.equal(lobbies[0].length, 8);
  });

  it("1 joueur → 1 lobby de 1", () => {
    const ids = makePlayerIds(1);
    const lobbies = generateRandomLobbies(ids);
    assert.equal(lobbies.length, 1);
    assert.equal(lobbies[0].length, 1);
    assert.equal(lobbies[0][0], 1);
  });

  it("le shuffle melange les joueurs (pas le meme ordre)", () => {
    const ids = makePlayerIds(32);
    const results = new Set<string>();
    for (let i = 0; i < 5; i++) {
      results.add(JSON.stringify(generateRandomLobbies(ids)));
    }
    assert.ok(results.size > 1, "Le shuffle devrait produire des ordres differents");
  });

  it("tous les joueurs sont presents sans doublon", () => {
    const ids = makePlayerIds(28);
    const lobbies = generateRandomLobbies(ids);
    const flat = lobbies.flat().sort((a, b) => a - b);
    assert.equal(flat.length, 28);
    assert.deepEqual(flat, ids);
  });
});
