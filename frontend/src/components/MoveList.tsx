import type { MoveAnnotation } from '../api/types'
import './MoveList.css'

type Props = {
  moves: MoveAnnotation[]
  selectedPly: number | null
  onSelect: (ply: number) => void
}

export function MoveList({ moves, selectedPly, onSelect }: Props) {
  const pairs: { num: number; white?: MoveAnnotation; black?: MoveAnnotation }[] = []
  for (const m of moves) {
    const num = Math.ceil(m.ply / 2)
    let pair = pairs.find((p) => p.num === num)
    if (!pair) {
      pair = { num }
      pairs.push(pair)
    }
    if (m.ply % 2 === 1) pair.white = m
    else pair.black = m
  }

  return (
    <div className="move-list">
      <div className="move-list__head">
        <h2>Moves</h2>
        <span>{moves.length || '—'} plies</span>
      </div>
      {moves.length === 0 ? (
        <p className="move-list__empty">No moves yet. Play on the board or load a PGN.</p>
      ) : (
        <ol>
          {pairs.map((pair) => (
            <li key={pair.num}>
              <span className="move-list__num">{pair.num}.</span>
              {pair.white && (
                <MoveButton move={pair.white} active={selectedPly === pair.white.ply} onSelect={onSelect} />
              )}
              {pair.black && (
                <MoveButton move={pair.black} active={selectedPly === pair.black.ply} onSelect={onSelect} />
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function MoveButton({
  move,
  active,
  onSelect,
}: {
  move: MoveAnnotation
  active: boolean
  onSelect: (ply: number) => void
}) {
  const sev = move.severity
  return (
    <button
      type="button"
      className={`move-list__san ${active ? 'is-active' : ''} ${
        sev === 'mistake' ? 'is-mistake' : sev === 'inaccuracy' ? 'is-inaccuracy' : ''
      }`}
      onClick={() => onSelect(move.ply)}
    >
      {move.san}
      {sev === 'mistake' && <span className="badge">??</span>}
      {sev === 'inaccuracy' && <span className="badge badge--soft">?!</span>}
    </button>
  )
}
