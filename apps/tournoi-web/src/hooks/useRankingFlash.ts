import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { PlayerRanking } from '../types';

const DEFAULT_FLASH_MS = 1500;

interface UseRankingFlashOptions {
  durationMs?: number;
}

export function useRankingFlash(
  rankings: PlayerRanking[],
  options: UseRankingFlashOptions = {}
): Set<number> {
  const duration = options.durationMs ?? DEFAULT_FLASH_MS;
  const reduceMotion = useReducedMotion() ?? false;

  const prevScoresRef = useRef<Map<number, number>>(new Map());
  const [flashingIds, setFlashingIds] = useState<Set<number>>(new Set());
  const flashTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    if (reduceMotion) {
      for (const r of rankings) {
        prevScoresRef.current.set(r.playerId, r.totalScore);
      }
      return;
    }

    const newFlashing = new Set<number>();
    for (const r of rankings) {
      const prev = prevScoresRef.current.get(r.playerId);
      if (prev !== undefined && prev !== r.totalScore) {
        newFlashing.add(r.playerId);
      }
      prevScoresRef.current.set(r.playerId, r.totalScore);
    }
    if (newFlashing.size === 0) return;

    const addTimeout = setTimeout(() => {
      flashTimeoutsRef.current.delete(addTimeout);
      setFlashingIds((prev) => {
        const next = new Set(prev);
        newFlashing.forEach((id) => next.add(id));
        return next;
      });
    }, 0);
    flashTimeoutsRef.current.add(addTimeout);

    const clearTimeoutId = setTimeout(() => {
      flashTimeoutsRef.current.delete(clearTimeoutId);
      setFlashingIds((prev) => {
        const next = new Set(prev);
        newFlashing.forEach((id) => next.delete(id));
        return next;
      });
    }, duration);
    flashTimeoutsRef.current.add(clearTimeoutId);
  }, [rankings, reduceMotion, duration]);

  useEffect(() => {
    const timeouts = flashTimeoutsRef.current;
    return () => {
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
    };
  }, []);

  return flashingIds;
}
