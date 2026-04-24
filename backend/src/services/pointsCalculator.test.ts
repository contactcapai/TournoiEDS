import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculatePoints, calculatePlayerStats } from "./pointsCalculator";
import type { PlayerRoundResult } from "./pointsCalculator";

describe("calculatePoints", () => {
  it("1er d'un lobby de 8 → 8 pts", () => {
    assert.equal(calculatePoints(1, 8), 8);
  });

  it("8e d'un lobby de 8 → 1 pt", () => {
    assert.equal(calculatePoints(8, 8), 1);
  });

  it("4e d'un lobby de 8 → 5 pts", () => {
    assert.equal(calculatePoints(4, 8), 5);
  });

  it("1er d'un lobby de 7 → 8 pts (bareme fixe sur 8)", () => {
    assert.equal(calculatePoints(1, 7), 8);
  });

  it("7e d'un lobby de 7 → 2 pts", () => {
    assert.equal(calculatePoints(7, 7), 2);
  });

  it("3e d'un lobby de 7 → 6 pts", () => {
    assert.equal(calculatePoints(3, 7), 6);
  });

  it("1er d'un lobby de 4 → 8 pts (bareme fixe sur 8)", () => {
    assert.equal(calculatePoints(1, 4), 8);
  });

  it("4e d'un lobby de 4 → 5 pts", () => {
    assert.equal(calculatePoints(4, 4), 5);
  });

  it("1er d'un lobby de 3 → 8 pts", () => {
    assert.equal(calculatePoints(1, 3), 8);
  });

  it("3e d'un lobby de 3 → 6 pts", () => {
    assert.equal(calculatePoints(3, 3), 6);
  });
});

describe("calculatePlayerStats", () => {
  it("aucun resultat → stats a zero", () => {
    const stats = calculatePlayerStats([]);
    assert.deepEqual(stats, {
      totalScore: 0,
      top1Count: 0,
      top4Count: 0,
      lastGameResult: 0,
      roundsPlayed: 0,
      average: 0,
    });
  });

  it("1 round — 1er sur 8 joueurs", () => {
    const results: PlayerRoundResult[] = [
      { placement: 1, points: 8, roundId: 1 },
    ];
    const stats = calculatePlayerStats(results);
    assert.equal(stats.totalScore, 8);
    assert.equal(stats.top1Count, 1);
    assert.equal(stats.top4Count, 1);
    assert.equal(stats.lastGameResult, 1);
    assert.equal(stats.roundsPlayed, 1);
    assert.equal(stats.average, 8);
  });

  it("1 round — 5e sur 8 joueurs (hors top 4)", () => {
    const results: PlayerRoundResult[] = [
      { placement: 5, points: 4, roundId: 1 },
    ];
    const stats = calculatePlayerStats(results);
    assert.equal(stats.totalScore, 4);
    assert.equal(stats.top1Count, 0);
    assert.equal(stats.top4Count, 0);
    assert.equal(stats.lastGameResult, 5);
    assert.equal(stats.roundsPlayed, 1);
    assert.equal(stats.average, 4);
  });

  it("multiples rounds — calcul cumule correct", () => {
    const results: PlayerRoundResult[] = [
      { placement: 1, points: 8, roundId: 1 },
      { placement: 3, points: 6, roundId: 2 },
      { placement: 5, points: 4, roundId: 3 },
    ];
    const stats = calculatePlayerStats(results);
    assert.equal(stats.totalScore, 18);
    assert.equal(stats.top1Count, 1);
    assert.equal(stats.top4Count, 2); // placement 1 et 3
    assert.equal(stats.lastGameResult, 5); // roundId 3
    assert.equal(stats.roundsPlayed, 3);
    assert.equal(stats.average, 6);
  });

  it("tiebreakers — top4Count inclut placement 4", () => {
    const results: PlayerRoundResult[] = [
      { placement: 4, points: 5, roundId: 1 },
      { placement: 4, points: 5, roundId: 2 },
    ];
    const stats = calculatePlayerStats(results);
    assert.equal(stats.top4Count, 2);
    assert.equal(stats.top1Count, 0);
  });

  it("lastGameResult est le placement du round avec le plus grand roundId", () => {
    const results: PlayerRoundResult[] = [
      { placement: 8, points: 1, roundId: 5 },
      { placement: 1, points: 8, roundId: 2 },
      { placement: 3, points: 6, roundId: 10 },
    ];
    const stats = calculatePlayerStats(results);
    assert.equal(stats.lastGameResult, 3); // roundId 10
  });

  it("moyenne arrondie a 2 decimales", () => {
    const results: PlayerRoundResult[] = [
      { placement: 1, points: 8, roundId: 1 },
      { placement: 2, points: 7, roundId: 2 },
      { placement: 3, points: 6, roundId: 3 },
    ];
    const stats = calculatePlayerStats(results);
    assert.equal(stats.average, 7); // 21/3 = 7

    const results2: PlayerRoundResult[] = [
      { placement: 1, points: 8, roundId: 1 },
      { placement: 3, points: 6, roundId: 2 },
    ];
    const stats2 = calculatePlayerStats(results2);
    assert.equal(stats2.average, 7); // 14/2 = 7

    const results3: PlayerRoundResult[] = [
      { placement: 1, points: 8, roundId: 1 },
      { placement: 2, points: 7, roundId: 2 },
      { placement: 8, points: 1, roundId: 3 },
    ];
    const stats3 = calculatePlayerStats(results3);
    assert.equal(stats3.average, 5.33); // 16/3 = 5.333...
  });
});
