import type { MoveAnnotation } from '../api/types'
import './GameSummary.css'

type Props = {
  moves: MoveAnnotation[]
}

export function GameSummary({ moves }: Props) {
  if (moves.length === 0) return null

  const mistakes = moves.filter((m) => m.severity === 'mistake')
  const inaccuracies = moves.filter((m) => m.severity === 'inaccuracy')
  const explained = moves.filter((m) => Boolean(m.explanation))
  const flagged = [...mistakes, ...inaccuracies]
  const avgSwing =
    flagged.length === 0
      ? 0
      : flagged.reduce((s, m) => s + (m.evalSwingCp ?? 0), 0) / flagged.length

  const accuracy =
    moves.length === 0
      ? 100
      : Math.max(0, Math.round(100 - (flagged.length / moves.length) * 100))

  return (
    <div className="summary" aria-label="Game accuracy summary">
      <div>
        <strong>{accuracy}%</strong>
        <span>Clean moves</span>
      </div>
      <div>
        <strong>{inaccuracies.length}</strong>
        <span>Inaccuracies</span>
      </div>
      <div>
        <strong>{mistakes.length}</strong>
        <span>Mistakes</span>
      </div>
      <div>
        <strong>{explained.length}</strong>
        <span>Coach notes</span>
      </div>
      <div>
        <strong>{avgSwing === 0 ? '—' : avgSwing.toFixed(1)}</strong>
        <span>Avg swing</span>
      </div>
    </div>
  )
}
