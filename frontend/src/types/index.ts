export interface RegisterPlayerInput {
  discordPseudo: string;
  riotPseudo: string;
  email: string;
}

export interface RegisterPlayerResponse {
  id: number;
  discordPseudo: string;
  riotPseudo: string;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface Player {
  id: number;
  discordPseudo: string;
  riotPseudo: string;
  email: string;
  status: string;
  createdAt: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface Day {
  id: number;
  number: number;
  type: 'qualification' | 'finale';
  status: 'in-progress' | 'completed';
  createdAt: string;
  rounds: Round[];
}

export interface Round {
  id: number;
  number: number;
  dayId: number;
  status: 'pending' | 'in-progress' | 'validated';
  createdAt: string;
  lobbies: Lobby[];
}

export interface Lobby {
  id: number;
  number: number;
  roundId: number;
  players: LobbyPlayerWithPlayer[];
}

export interface LobbyPlayerWithPlayer {
  id: number;
  lobbyId: number;
  playerId: number;
  placement: number | null;
  points: number | null;
  player: Player;
}

export interface PlacementInput {
  lobbyPlayerId: number;
  placement: number;
}

export interface PlayerRoundSummary {
  dayNumber: number;
  roundNumber: number;
  placement: number;
  points: number;
}

export interface PlayerRanking {
  rank: number;
  playerId: number;
  discordPseudo: string;
  totalScore: number;
  top1Count: number;
  top4Count: number;
  lastGameResult: number;
  roundsPlayed: number;
  average: number;
  roundResults: PlayerRoundSummary[];
  isDropped: boolean;
}

export interface RoundValidationResult {
  round: Round;
  rankings: PlayerRanking[];
}
