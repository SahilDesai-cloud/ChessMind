import type { AnalyzeResponse, MistakeCategory, MoveAnnotation, Severity } from '../api/types'

export function annotationFromAnalysis(
  ply: number,
  a: AnalyzeResponse,
  explanation: string | null,
  category: MistakeCategory | null,
  explained: boolean,
): MoveAnnotation {
  return {
    ply,
    san: a.move_san,
    uci: a.move_uci,
    fenBefore: a.fen_before,
    fenAfter: a.fen_after,
    evalAfterCp: a.eval_after.cp,
    evalAfterMate: a.eval_after.mate,
    evalSwingCp: a.eval_swing_cp,
    bestMoveSan: a.best_move_san,
    bestMoveUci: a.best_move_uci,
    explanation,
    category,
    explained,
    severity: a.severity ?? 'ok',
  }
}

export function buildAnnotatedPgn(moves: MoveAnnotation[]): string {
  const parts: string[] = []
  for (const m of moves) {
    const prefix = m.ply % 2 === 1 ? `${Math.ceil(m.ply / 2)}. ` : ''
    let comment = ''
    if (m.explanation) {
      comment = ` {${m.explanation}}`
    } else if (m.severity !== 'ok' && m.evalSwingCp !== null) {
      comment = ` {${m.severity} ${m.evalSwingCp.toFixed(2)}; best ${m.bestMoveSan ?? '?'}}`
    }
    parts.push(`${prefix}${m.san}${comment}`)
  }
  return parts.join(' ')
}

export function flaggedPlies(moves: MoveAnnotation[], min: Severity = 'inaccuracy'): number[] {
  return moves
    .filter((m) => {
      if (min === 'mistake') return m.severity === 'mistake'
      return m.severity === 'inaccuracy' || m.severity === 'mistake'
    })
    .map((m) => m.ply)
}

export function uciToArrow(uci: string | null) {
  if (!uci || uci.length < 4) return []
  return [
    {
      startSquare: uci.slice(0, 2),
      endSquare: uci.slice(2, 4),
      color: 'rgba(201, 162, 39, 0.75)',
    },
  ]
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
