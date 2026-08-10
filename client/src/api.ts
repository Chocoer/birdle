import type { Conservation, Difficulty, GameStateResponse, SearchResult, StatsData } from './types';

const BASE = '/api';

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, { credentials: 'include', ...init });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : 'unknown';
    throw new ApiError(code, res.status);
  }
  return data as T;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function searchBirds(
  q: string,
  difficulty?: Difficulty,
): Promise<{ results: SearchResult[] }> {
  const params = new URLSearchParams({ q });
  if (difficulty) params.set('difficulty', difficulty);
  return request(`/birds/search?${params.toString()}`);
}

export function startGame(
  difficulty: Difficulty,
  guestId: string,
  conservation: Conservation,
): Promise<GameStateResponse> {
  return request('/game/start', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ difficulty, guestId, conservation }),
  });
}

export function submitGuess(
  gameId: string,
  birdId: number,
  guestId: string,
): Promise<GameStateResponse> {
  return request(`/game/${encodeURIComponent(gameId)}/guess`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ birdId, guestId }),
  });
}

export function revealAnswer(gameId: string, guestId: string): Promise<GameStateResponse> {
  return request(`/game/${encodeURIComponent(gameId)}/reveal`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ guestId }),
  });
}

export function getStats(guestId: string): Promise<StatsData> {
  return request(`/stats?guestId=${encodeURIComponent(guestId)}`);
}

// --- 账号 ---

export function authMe(): Promise<{ user: { username: string } | null }> {
  return request('/auth/me');
}

export function authRegister(
  username: string,
  password: string,
  guestId: string,
): Promise<{ user: { username: string }; merged: number }> {
  return request('/auth/register', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ username, password, guestId }),
  });
}

export function authLogin(
  username: string,
  password: string,
  guestId: string,
): Promise<{ user: { username: string }; merged: number }> {
  return request('/auth/login', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ username, password, guestId }),
  });
}

export function authLogout(): Promise<{ ok: boolean }> {
  return request('/auth/logout', { method: 'POST', headers: JSON_HEADERS, body: '{}' });
}
