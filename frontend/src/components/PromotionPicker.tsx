import './PromotionPicker.css'

type Props = {
  color: 'w' | 'b'
  onPick: (piece: 'q' | 'r' | 'b' | 'n') => void
  onCancel: () => void
}

const PIECES: { id: 'q' | 'r' | 'b' | 'n'; label: string; white: string; black: string }[] = [
  { id: 'q', label: 'Queen', white: '♕', black: '♛' },
  { id: 'r', label: 'Rook', white: '♖', black: '♜' },
  { id: 'b', label: 'Bishop', white: '♗', black: '♝' },
  { id: 'n', label: 'Knight', white: '♘', black: '♞' },
]

export function PromotionPicker({ color, onPick, onCancel }: Props) {
  return (
    <div className="promo" role="dialog" aria-modal="true" aria-label="Choose promotion piece">
      <div className="promo__panel">
        <h2>Promote to</h2>
        <div className="promo__choices">
          {PIECES.map((p) => (
            <button key={p.id} type="button" onClick={() => onPick(p.id)} aria-label={p.label}>
              <span aria-hidden="true">{color === 'w' ? p.white : p.black}</span>
              {p.label}
            </button>
          ))}
        </div>
        <button type="button" className="promo__cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
