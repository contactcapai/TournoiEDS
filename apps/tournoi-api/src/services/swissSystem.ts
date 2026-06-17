const LOBBY_SIZE = 8;

export function generateSwissLobbies(rankedPlayerIds: number[]): number[][] {
  const lobbies: number[][] = [];
  for (let i = 0; i < rankedPlayerIds.length; i += LOBBY_SIZE) {
    lobbies.push(rankedPlayerIds.slice(i, i + LOBBY_SIZE));
  }
  return lobbies;
}
