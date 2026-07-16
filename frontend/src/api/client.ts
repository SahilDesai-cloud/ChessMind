import type {
  AnalyzeMoveResponse,
  AnalyzePgnResponse,
  CoachStatsResponse,
  EngineMoveResponse,
} from './types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
export const USER_ID = import.meta.env.VITE_USER_ID ?? 'default'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(detail || res.statusText)
  }
  return res.json() as Promise<T>
}

export async function createGame(pgn?: string): Promise<{ id: string }> {
  return request('/games', {
    method: 'POST',
    body: JSON.stringify({ user_id: USER_ID, pgn: pgn ?? null }),
  })
}

export async function analyzeMove(payload: {
  fen: string
  move: string
  ply: number
  game_id?: string | null
  persist?: boolean
  explain?: boolean
}): Promise<AnalyzeMoveResponse> {
  return request('/analyze-move', {
    method: 'POST',
    body: JSON.stringify({
      fen: payload.fen,
      move: payload.move,
      ply: payload.ply,
      user_id: USER_ID,
      game_id: payload.game_id ?? null,
      persist: payload.persist ?? true,
      explain: payload.explain ?? true,
    }),
  })
}

export async function analyzePgn(payload: {
  pgn: string
  persist?: boolean
  explain?: boolean
}): Promise<AnalyzePgnResponse> {
  return request('/analyze-pgn', {
    method: 'POST',
    body: JSON.stringify({
      pgn: payload.pgn,
      user_id: USER_ID,
      persist: payload.persist ?? true,
      explain: payload.explain ?? true,
    }),
  })
}

export async function engineMove(fen: string): Promise<EngineMoveResponse> {
  return request('/engine-move', {
    method: 'POST',
    body: JSON.stringify({ fen }),
  })
}

export async function getOpening(movesUci: string[]): Promise<{ name: string }> {
  return request('/opening', {
    method: 'POST',
    body: JSON.stringify({ moves_uci: movesUci }),
  })
}

export async function getCoachStats(): Promise<CoachStatsResponse> {
  return request(`/coach/stats?user_id=${encodeURIComponent(USER_ID)}`)
}
