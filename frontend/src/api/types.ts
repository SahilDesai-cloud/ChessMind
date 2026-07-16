export type MistakeCategory =
  | 'hangs_pieces'
  | 'missed_tactic'
  | 'weak_king_safety'
  | 'bad_opening_theory'
  | 'lost_tempo'
  | 'blunder_other'

export type Severity = 'ok' | 'inaccuracy' | 'mistake'

export type EvalScore = {
  cp: number | null
  mate: number | null
}

export type AnalyzeResponse = {
  fen_before: string
  fen_after: string
  move_uci: string
  move_san: string
  eval_before: EvalScore
  eval_after: EvalScore
  eval_swing_cp: number | null
  best_move_uci: string | null
  best_move_san: string | null
  best_eval: EvalScore | null
  depth: number
  severity: Severity
}

export type ExplainResponse = {
  explanation: string
  category: MistakeCategory
  phase: string
  model: string
}

export type AnalyzeMoveResponse = {
  analysis: AnalyzeResponse
  explained: boolean
  explanation: ExplainResponse | null
  game_id: string | null
  move_id: string | null
  mistake: {
    id: string
    category: MistakeCategory
    explanation: string
    eval_swing_cp: number
    phase: string
  } | null
}

export type AnalyzePgnResponse = {
  game_id: string | null
  opening: string | null
  moves: {
    ply: number
    analysis: AnalyzeResponse
    explained: boolean
    explanation: ExplainResponse | null
    mistake: AnalyzeMoveResponse['mistake']
  }[]
  mistake_count: number
  inaccuracy_count: number
}

export type EngineMoveResponse = {
  fen_before: string
  fen_after: string
  move_uci: string
  move_san: string
  eval_after: EvalScore
  depth: number
}

export type CategoryStat = {
  category: MistakeCategory
  count: number
  percentage: number
  by_phase: Record<string, number>
}

export type CoachStatsResponse = {
  user_id: string
  total_mistakes: number
  total_games: number
  categories: CategoryStat[]
  top_insight: string | null
}

export type MoveAnnotation = {
  ply: number
  san: string
  uci: string
  fenBefore: string
  fenAfter: string
  evalAfterCp: number | null
  evalAfterMate: number | null
  evalSwingCp: number | null
  bestMoveSan: string | null
  bestMoveUci: string | null
  explanation: string | null
  category: MistakeCategory | null
  explained: boolean
  severity: Severity
}

export const CATEGORY_LABELS: Record<MistakeCategory, string> = {
  hangs_pieces: 'Hangs pieces',
  missed_tactic: 'Missed tactic',
  weak_king_safety: 'Weak king safety',
  bad_opening_theory: 'Bad opening theory',
  lost_tempo: 'Lost tempo',
  blunder_other: 'Other blunder',
}

export const SAMPLE_PGN = `1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#`
