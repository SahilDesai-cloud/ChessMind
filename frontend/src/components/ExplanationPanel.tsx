import { CATEGORY_LABELS, type MoveAnnotation } from '../api/types'
import './ExplanationPanel.css'

type Props = {
  move: MoveAnnotation | null
  loading: boolean
}

export function ExplanationPanel({ move, loading }: Props) {
  if (loading) {
    return (
      <section className="explain">
        <h2>Coach note</h2>
        <p className="explain__muted explain__pulse">Stockfish is scoring this position…</p>
      </section>
    )
  }

  if (!move) {
    return (
      <section className="explain">
        <h2>Coach note</h2>
        <p className="explain__muted">
          Inaccuracies (−1.0) and mistakes (−1.5) get notes. Mistakes call Claude when an API key is
          set; otherwise a Stockfish fallback note is stored for Coach.
        </p>
      </section>
    )
  }

  const hot = move.severity !== 'ok'
  return (
    <section className={`explain ${hot ? 'explain--hot' : ''}`}>
      <h2>Coach note</h2>
      <div className="explain__meta">
        <span className="explain__san">{move.san}</span>
        <span className={`sev sev--${move.severity}`}>{move.severity}</span>
        {move.evalSwingCp !== null && (
          <span className={move.evalSwingCp <= -1.0 ? 'bad' : 'ok'}>
            {move.evalSwingCp >= 0 ? '+' : ''}
            {move.evalSwingCp.toFixed(2)}
          </span>
        )}
        {move.bestMoveSan && <span>Best: {move.bestMoveSan}</span>}
        {move.category && <span className="tag">{CATEGORY_LABELS[move.category]}</span>}
        {move.explained && <span className="tag">Claude</span>}
        {!move.explained && move.explanation && <span className="tag">Fallback</span>}
      </div>
      {move.explanation ? (
        <p className="explain__body">{move.explanation}</p>
      ) : (
        <p className="explain__muted">Clean enough — above the inaccuracy threshold.</p>
      )}
    </section>
  )
}
