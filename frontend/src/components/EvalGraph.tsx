import type { MoveAnnotation } from '../api/types'
import './EvalGraph.css'

type Props = {
  moves: MoveAnnotation[]
  selectedPly: number | null
  onSelect: (ply: number) => void
}

function pointY(cp: number | null, mate: number | null): number {
  if (mate !== null) return mate > 0 ? 8 : 92
  if (cp === null) return 50
  const clamped = Math.max(-600, Math.min(600, cp))
  return 50 - (clamped / 600) * 42
}

export function EvalGraph({ moves, selectedPly, onSelect }: Props) {
  if (moves.length === 0) return null

  const w = 320
  const h = 88
  const pad = 6
  const xs = moves.map((_, i) => pad + (i / Math.max(moves.length - 1, 1)) * (w - pad * 2))
  const ys = moves.map((m) => pointY(m.evalAfterCp, m.evalAfterMate))
  const mid = h / 2

  const area = [
    `${pad},${mid}`,
    ...xs.map((x, i) => `${x},${ys[i]}`),
    `${xs[xs.length - 1]},${mid}`,
  ].join(' ')

  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ')

  return (
    <div className="eval-graph">
      <div className="eval-graph__head">
        <h3>Eval trend</h3>
        <span>Click a point to jump</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="eval-graph__svg" role="img" aria-label="Evaluation over moves">
        <line x1={pad} y1={mid} x2={w - pad} y2={mid} className="eval-graph__zero" />
        <polygon points={area} className="eval-graph__area" />
        <path d={line} className="eval-graph__line" />
        {moves.map((m, i) => (
          <circle
            key={m.ply}
            cx={xs[i]}
            cy={ys[i]}
            r={selectedPly === m.ply ? 4.5 : m.explanation ? 3.5 : 2.5}
            className={`eval-graph__dot ${selectedPly === m.ply ? 'is-active' : ''} ${
              m.explanation ? 'is-mistake' : ''
            }`}
            onClick={() => onSelect(m.ply)}
          >
            <title>
              {m.san}: {m.evalAfterCp !== null ? (m.evalAfterCp / 100).toFixed(2) : 'mate'}
            </title>
          </circle>
        ))}
      </svg>
    </div>
  )
}
