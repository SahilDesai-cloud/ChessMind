import './BoardControls.css'

type Props = {
  canPrev: boolean
  canNext: boolean
  orientation: 'white' | 'black'
  showBestArrow: boolean
  busy: boolean
  progress?: { current: number; total: number } | null
  mistakeOnly?: boolean
  mistakeCount?: number
  onFirst: () => void
  onPrev: () => void
  onNext: () => void
  onLast: () => void
  onFlip: () => void
  onToggleArrow: () => void
  onToggleMistakeOnly?: () => void
  onUndo: () => void
  canUndo: boolean
}

export function BoardControls({
  canPrev,
  canNext,
  orientation,
  showBestArrow,
  busy,
  progress,
  mistakeOnly = false,
  mistakeCount = 0,
  onFirst,
  onPrev,
  onNext,
  onLast,
  onFlip,
  onToggleArrow,
  onToggleMistakeOnly,
  onUndo,
  canUndo,
}: Props) {
  return (
    <div className="board-controls">
      <div className="board-controls__nav" role="group" aria-label="Move navigation">
        <button type="button" onClick={onFirst} disabled={!canPrev} aria-label="First move">
          «
        </button>
        <button type="button" onClick={onPrev} disabled={!canPrev && !mistakeOnly} aria-label="Previous">
          ‹
        </button>
        <button type="button" onClick={onNext} disabled={!canNext && !mistakeOnly} aria-label="Next">
          ›
        </button>
        <button type="button" onClick={onLast} disabled={!canNext} aria-label="Last move">
          »
        </button>
      </div>

      <div className="board-controls__tools">
        <button type="button" onClick={onFlip} aria-pressed={orientation === 'black'}>
          Flip ({orientation === 'white' ? 'W' : 'B'})
        </button>
        <button type="button" onClick={onToggleArrow} aria-pressed={showBestArrow}>
          {showBestArrow ? 'Hide arrow' : 'Best arrow'}
        </button>
        {onToggleMistakeOnly && (
          <button
            type="button"
            onClick={onToggleMistakeOnly}
            aria-pressed={mistakeOnly}
            title="Jump only between inaccuracies and mistakes"
          >
            Mistakes ({mistakeCount})
          </button>
        )}
        <button type="button" onClick={onUndo} disabled={!canUndo || busy}>
          Undo
        </button>
      </div>

      {progress && progress.total > 0 && (
        <div className="board-controls__progress" aria-live="polite">
          <div
            className="board-controls__bar"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
          <span>
            Analyzing {progress.current}/{progress.total}
          </span>
        </div>
      )}
    </div>
  )
}
