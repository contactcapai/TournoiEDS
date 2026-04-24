import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateSwissLobbies } from "./swissSystem";

function makeRankedPlayerIds(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i + 1);
}

describe("generateSwissLobbies", () => {
  it("32 joueurs → 4 lobbies de 8", () => {
    const ids = makeRankedPlayerIds(32);
    const lobbies = generateSwissLobbies(ids);
    assert.equal(lobbies.length, 4);
    for (const lobby of lobbies) {
      assert.equal(lobby.length, 8);
    }
  });

  it("28 joueurs → 3 lobbies de 8 + 1 lobby de 4", () => {
    const ids = makeRankedPlayerIds(28);
    const lobbies = generateSwissLobbies(ids);
    assert.equal(lobbies.length, 4);
    const sizes = lobbies.map((l) => l.length);
    assert.deepEqual(sizes, [8, 8, 8, 4]);
  });

  it("16 joueurs → 2 lobbies de 8", () => {
    const ids = makeRankedPlayerIds(16);
    const lobbies = generateSwissLobbies(ids);
    assert.equal(lobbies.length, 2);
    for (const lobby of lobbies) {
      assert.equal(lobby.length, 8);
    }
  });

  it("15 joueurs → 1 lobby de 8 + 1 lobby de 7", () => {
    const ids = makeRankedPlayerIds(15);
    const lobbies = generateSwissLobbies(ids);
    assert.equal(lobbies.length, 2);
    const sizes = lobbies.map((l) => l.length);
    assert.deepEqual(sizes, [8, 7]);
  });

  it("8 joueurs → 1 lobby de 8", () => {
    const ids = makeRankedPlayerIds(8);
    const lobbies = generateSwissLobbies(ids);
    assert.equal(lobbies.length, 1);
    assert.equal(lobbies[0].length, 8);
  });

  it("3 joueurs → 1 lobby de 3", () => {
    const ids = makeRankedPlayerIds(3);
    const lobbies = generateSwissLobbies(ids);
    assert.equal(lobbies.length, 1);
    assert.equal(lobbies[0].length, 3);
  });

  it("l'ordre de classement est preserve dans chaque lobby", () => {
    const ids = makeRankedPlayerIds(16);
    const lobbies = generateSwissLobbies(ids);
    // Lobby 1 = joueurs rang 1-8
    assert.deepEqual(lobbies[0], [1, 2, 3, 4, 5, 6, 7, 8]);
    // Lobby 2 = joueurs rang 9-16
    assert.deepEqual(lobbies[1], [9, 10, 11, 12, 13, 14, 15, 16]);
  });

  it("aucun joueur n'est duplique ou oublie", () => {
    const ids = makeRankedPlayerIds(28);
    const lobbies = generateSwissLobbies(ids);
    const flat = lobbies.flat().sort((a, b) => a - b);
    assert.equal(flat.length, 28);
    assert.deepEqual(flat, ids);
  });
});
