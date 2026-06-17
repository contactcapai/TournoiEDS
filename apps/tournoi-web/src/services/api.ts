import type { RegisterPlayerInput, RegisterPlayerResponse, LoginInput, LoginResponse, ApiError, Player, Day, Round, PlacementInput, RoundValidationResult, Lobby, PlayerRanking } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function registerPlayer(
  data: RegisterPlayerInput
): Promise<{ data: RegisterPlayerResponse } | { error: ApiError }> {
  const response = await fetch(`${API_URL}/api/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    return { error: result.error as ApiError };
  }

  return { data: result.data as RegisterPlayerResponse };
}

export async function loginAdmin(
  data: LoginInput
): Promise<{ data: LoginResponse } | { error: ApiError }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    const result = await response.json();

    if (!response.ok) {
      return { error: result.error as ApiError };
    }

    return { data: result.data as LoginResponse };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getAdminPlayers(
  token: string
): Promise<{ data: Player[] } | { error: ApiError }> {
  const response = await fetch(`${API_URL}/api/admin/players`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as Player[] };
}

export async function addAdminPlayer(
  token: string,
  data: RegisterPlayerInput
): Promise<{ data: Player } | { error: ApiError }> {
  const response = await fetch(`${API_URL}/api/admin/players`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as Player };
}

export async function updatePlayer(
  token: string,
  playerId: number,
  data: Partial<Pick<Player, 'status' | 'discordPseudo' | 'riotPseudo' | 'email'>>
): Promise<{ data: Player } | { error: ApiError }> {
  const response = await fetch(`${API_URL}/api/admin/players/${playerId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as Player };
}

export async function startDay(
  token: string
): Promise<{ data: Day } | { error: ApiError }> {
  const response = await fetch(`${API_URL}/api/admin/days`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as Day };
}

export async function startFinale(
  token: string
): Promise<{ data: { day: Day; finalists: PlayerRanking[] } } | { error: ApiError }> {
  const response = await fetch(`${API_URL}/api/admin/finale/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as { day: Day; finalists: PlayerRanking[] } };
}

export interface FinaleProgression {
  completedQualDaysCount: number;
  hasFinale: boolean;
}

export async function getFinaleProgression(
  token: string
): Promise<{ data: FinaleProgression } | { error: ApiError }> {
  const response = await fetch(`${API_URL}/api/admin/finale/progression`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as FinaleProgression };
}

export async function getCurrentDay(
  token: string
): Promise<{ data: Day | null } | { error: ApiError }> {
  const response = await fetch(`${API_URL}/api/admin/days/current`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as Day | null };
}

export async function generateLobbies(
  token: string,
  dayId: number,
  roundNumber: number
): Promise<{ data: Round } | { error: ApiError }> {
  const response = await fetch(
    `${API_URL}/api/admin/days/${dayId}/rounds/${roundNumber}/generate-lobbies`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as Round };
}

export async function regenerateLobbies(
  token: string,
  dayId: number,
  roundNumber: number
): Promise<{ data: Round } | { error: ApiError }> {
  const response = await fetch(
    `${API_URL}/api/admin/days/${dayId}/rounds/${roundNumber}/regenerate-lobbies`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as Round };
}

export async function submitPlacements(
  token: string,
  dayId: number,
  roundNumber: number,
  lobbyId: number,
  placements: PlacementInput[]
): Promise<{ data: Lobby } | { error: ApiError }> {
  const response = await fetch(
    `${API_URL}/api/admin/days/${dayId}/rounds/${roundNumber}/lobbies/${lobbyId}/placements`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ placements }),
    }
  );
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as Lobby };
}

export async function validateRound(
  token: string,
  dayId: number,
  roundNumber: number
): Promise<{ data: RoundValidationResult } | { error: ApiError }> {
  const response = await fetch(
    `${API_URL}/api/admin/days/${dayId}/rounds/${roundNumber}/validate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as RoundValidationResult };
}

export async function fetchRankings(): Promise<{ data: PlayerRanking[] } | { error: ApiError }> {
  const response = await fetch(`${API_URL}/api/rankings`);
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as PlayerRanking[] };
}

/** Fetch les rankings de la finale. Voir 5.2 Task 6 pour le backend. */
export async function fetchFinaleRankings(): Promise<{ data: PlayerRanking[] } | { error: ApiError }> {
  const response = await fetch(`${API_URL}/api/rankings?type=finale`);
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as PlayerRanking[] };
}

export async function nextRound(
  token: string,
  dayId: number
): Promise<{ data: Day } | { error: ApiError }> {
  const response = await fetch(`${API_URL}/api/admin/days/${dayId}/next-round`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as Day };
}

export async function completeDay(
  token: string,
  dayId: number
): Promise<{ data: { message: string } } | { error: ApiError }> {
  const response = await fetch(`${API_URL}/api/admin/days/${dayId}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as { message: string } };
}

async function adminReset(
  token: string,
  path: 'finale' | 'qualifications' | 'players'
): Promise<{ data: { message: string } } | { error: ApiError }> {
  const response = await fetch(`${API_URL}/api/admin/reset/${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json();
  if (!response.ok) return { error: result.error as ApiError };
  return { data: result.data as { message: string } };
}

export function resetFinale(token: string) {
  return adminReset(token, 'finale');
}

export function resetQualifications(token: string) {
  return adminReset(token, 'qualifications');
}

export function resetPlayers(token: string) {
  return adminReset(token, 'players');
}
