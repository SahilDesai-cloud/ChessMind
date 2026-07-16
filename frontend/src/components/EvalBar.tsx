import './EvalBar.css'

type Props = {
  cp: number | null
  mate: number | null
}

function whiteShare(cp: number | null, mate: number | null): number {
  if (mate !== null) return mate > 0 ? 0.97 : 0.03
  if (cp === null) return 0.5
  const clamped = Math.max(-800, Math.min(800, cp))
  return 0.5 + clamped / 1600
}

export function EvalBar({ cp, mate }: Props) {
  const white = whiteShare(cp, mate)
  const label =
    mate !== null
      ? `M${Math.abs(mate)}`
      : cp === null
        ? '—'
        : `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(1)}`

  return (
    <div className="eval-bar" aria-label={`Evaluation ${label}`}>
      <div className="eval-bar__track">
        <div className="eval-bar__white" style={{ height: `${white * 100}%` }} />
      </div>
      <div className="eval-bar__label">{label}</div>
    </div>
  )
}
