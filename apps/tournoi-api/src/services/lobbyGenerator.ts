const LOBBY_SIZE = 8;

function shuffleArray(array: number[]): number[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function generateRandomLobbies(playerIds: number[]): number[][] {
  const shuffled = shuffleArray(playerIds);
  const lobbies: number[][] = [];

  for (let i = 0; i < shuffled.length; i += LOBBY_SIZE) {
    lobbies.push(shuffled.slice(i, i + LOBBY_SIZE));
  }

  return lobbies;
}
