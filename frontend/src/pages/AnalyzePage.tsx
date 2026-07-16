import { useCallback, useEffect, useMemo, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { analyzeMove, analyzePgn, getOpening } from '../api/client'
import { SAMPLE_PGN, type MoveAnnotation } from '../api/types'
import { BoardControls } from '../components/BoardControls'
import { EvalBar } from '../components/EvalBar'
import { EvalGraph } from '../components/EvalGraph'
import { ExplanationPanel } from '../components/ExplanationPanel'
import { GameSummary } from '../components/GameSummary'
import { MoveList } from '../components/MoveList'
import { PromotionPicker } from '../components/PromotionPicker'
import {
  START_FEN,
  annotationFromAnalysis,
  buildAnnotatedPgn,
  flaggedPlies,
  uciToArrow,
} from '../lib/chessHelpers'
import { readShareFromLocation, writeShareToLocation } from '../lib/share'
import './AnalyzePage.css'

type PendingPromotion = {
  from: Square
  to: Square
  color: 'w' | 'b'
  fenBefore: string
  baseMoves: MoveAnnotation[]
}

export function AnalyzePage() {
  const [game] = useState(() => new Chess())
  const [fen, setFen] = useState(START_FEN)
  const [moves, setMoves] = useState<MoveAnnotation[]>([])
  const [selectedPly, setSelectedPly] = useState<number | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [pgnText, setPgnText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [evalCp, setEvalCp] = useState<number | null>(40)
  const [evalMate, setEvalMate] = useState<number | null>(null)
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [showBestArrow, setShowBestArrow] = useState(true)
  const [copyMsg, setCopyMsg] = useState<string | null>(null)
  const [opening, setOpening] = useState('Starting position')
  const [pendingPromo, setPendingPromo] = useState<PendingPromotion | null>(null)
  const [mistakeOnly, setMistakeOnly] = useState(false)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [bootstrapped, setBootstrapped] = useState(false)

  const selectedMove = useMemo(
    () => moves.find((m) => m.ply === selectedPly) ?? null,
    [moves, selectedPly],
  )

  const mistakePlies = useMemo(() => flaggedPlies(moves, 'inaccuracy'), [moves])

  const goToPly = useCallback(
    (ply: number | null) => {
      if (ply === null) {
        setFen(START_FEN)
        setSelectedPly(null)
        setEvalCp(40)
        setEvalMate(null)
        return
      }
      const m = moves.find((x) => x.ply === ply)
      if (!m) return
      setSelectedPly(ply)
      setFen(m.fenAfter)
      setEvalCp(m.evalAfterCp)
      setEvalMate(m.evalAfterMate)
    },
    [moves],
  )

  const refreshOpening = useCallback(async (list: MoveAnnotation[]) => {
    try {
      const res = await getOpening(list.map((m) => m.uci))
      setOpening(res.name)
    } catch {
      setOpening(list.length ? 'Unknown opening' : 'Starting position')
    }
  }, [])

  const resetBoard = useCallback(() => {
    game.reset()
    setFen(game.fen())
    setMoves([])
    setSelectedPly(null)
    setGameId(null)
    setEvalCp(40)
    setEvalMate(null)
    setError(null)
    setCopyMsg(null)
    setOpening('Starting position')
    setPendingPromo(null)
  }, [game])

  const processMove = useCallback(
    async (fenBefore: string, uci: string, ply: number, currentGameId: string | null) => {
      setBusy(true)
      setError(null)
      try {
        const result = await analyzeMove({
          fen: fenBefore,
          move: uci,
          ply,
          game_id: currentGameId,
          persist: true,
        })
        const a = result.analysis
        const annotation = annotationFromAnalysis(
          ply,
          a,
          result.explanation?.explanation ?? result.mistake?.explanation ?? null,
          result.explanation?.category ?? result.mistake?.category ?? null,
          result.explained,
        )
        setMoves((prev) => {
          const next = [...prev.slice(0, ply - 1), annotation]
          void refreshOpening(next)
          return next
        })
        setSelectedPly(ply)
        setEvalCp(a.eval_after.cp)
        setEvalMate(a.eval_after.mate)
        if (result.game_id) setGameId(result.game_id)
        return result.game_id
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Analysis failed')
        return currentGameId
      } finally {
        setBusy(false)
      }
    },
    [refreshOpening],
  )

  const commitBoardMove = useCallback(
    (
      from: Square,
      to: Square,
      promotion: 'q' | 'r' | 'b' | 'n',
      fenBefore: string,
      baseMoves: MoveAnnotation[],
    ) => {
      const board = new Chess(fenBefore)
      const move = board.move({ from, to, promotion })
      if (!move) return
      setMoves(baseMoves)
      game.load(board.fen())
      setFen(board.fen())
      const ply = baseMoves.length + 1
      void processMove(fenBefore, move.lan, ply, gameId)
    },
    [game, gameId, processMove],
  )

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
      if (!targetSquare || busy) return false

      const baseMoves =
        selectedPly !== null && selectedPly < moves.length
          ? moves.slice(0, selectedPly)
          : moves

      const board = new Chess()
      if (baseMoves.length > 0) board.load(baseMoves[baseMoves.length - 1].fenAfter)

      const from = sourceSquare as Square
      const to = targetSquare as Square
      const piece = board.get(from)
      if (!piece) return false

      const fenBefore = board.fen()
      const isPromo =
        piece.type === 'p' &&
        ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'))

      if (isPromo) {
        // Validate legality with queen promo first
        const test = board.move({ from, to, promotion: 'q' })
        if (!test) return false
        board.undo()
        setPendingPromo({ from, to, color: piece.color, fenBefore, baseMoves })
        return false
      }

      const move = board.move({ from, to })
      if (!move) return false

      setMoves(baseMoves)
      game.load(board.fen())
      setFen(board.fen())
      void processMove(fenBefore, move.lan, baseMoves.length + 1, gameId)
      return true
    },
    [busy, game, gameId, moves, processMove, selectedPly],
  )

  const loadPgn = async (raw?: string) => {
    const text = (raw ?? pgnText).trim()
    if (!text || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await analyzePgn({ pgn: text, persist: true, explain: true })
      const annotations = result.moves.map((m) =>
        annotationFromAnalysis(
          m.ply,
          m.analysis,
          m.explanation?.explanation ?? m.mistake?.explanation ?? null,
          m.explanation?.category ?? m.mistake?.category ?? null,
          m.explained,
        ),
      )
      resetBoard()
      setPgnText(text)
      setMoves(annotations)
      setGameId(result.game_id)
      setOpening(result.opening ?? 'Unknown opening')
      if (annotations.length) {
        const last = annotations[annotations.length - 1]
        game.load(last.fenAfter)
        setFen(last.fenAfter)
        setSelectedPly(last.ply)
        setEvalCp(last.evalAfterCp)
        setEvalMate(last.evalAfterMate)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PGN analysis failed')
    } finally {
      setBusy(false)
    }
  }

  const undoLast = () => {
    if (busy || moves.length === 0) return
    const next = moves.slice(0, -1)
    setMoves(next)
    void refreshOpening(next)
    if (next.length === 0) {
      game.reset()
      setFen(START_FEN)
      setSelectedPly(null)
      setEvalCp(40)
      setEvalMate(null)
    } else {
      const tip = next[next.length - 1]
      game.load(tip.fenAfter)
      setFen(tip.fenAfter)
      setSelectedPly(tip.ply)
      setEvalCp(tip.evalAfterCp)
      setEvalMate(tip.evalAfterMate)
    }
  }

  const jumpMistake = (dir: 1 | -1) => {
    if (mistakePlies.length === 0) return
    const idx =
      selectedPly === null
        ? dir === 1
          ? -1
          : mistakePlies.length
        : mistakePlies.findIndex((p) => p === selectedPly)
    let nextIdx: number
    if (idx === -1) {
      nextIdx = dir === 1 ? 0 : mistakePlies.length - 1
    } else {
      nextIdx = idx + dir
    }
    if (nextIdx < 0 || nextIdx >= mistakePlies.length) return
    goToPly(mistakePlies[nextIdx])
  }

  const copyAnnotated = async () => {
    const pgn = buildAnnotatedPgn(moves)
    if (!pgn) return
    try {
      await navigator.clipboard.writeText(pgn)
      setCopyMsg('Annotated PGN copied')
      setTimeout(() => setCopyMsg(null), 2000)
    } catch {
      setCopyMsg('Copy failed')
    }
  }

  const shareGame = async () => {
    const pgn = buildAnnotatedPgn(moves).replace(/ \{[^}]*\}/g, '') || pgnText
    const url = writeShareToLocation({ v: 1, pgn: pgn || undefined, fen, mode: 'analyze' })
    try {
      await navigator.clipboard.writeText(url)
      setShareMsg('Share link copied')
      setTimeout(() => setShareMsg(null), 2000)
    } catch {
      setShareMsg(url)
    }
  }

  useEffect(() => {
    if (bootstrapped) return
    setBootstrapped(true)
    const shared = readShareFromLocation()
    if (shared?.pgn) {
      setPgnText(shared.pgn)
      void loadPgn(shared.pgn)
    } else if (shared?.fen) {
      try {
        game.load(shared.fen)
        setFen(shared.fen)
      } catch {
        // ignore bad share fen
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapped])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (mistakeOnly) jumpMistake(-1)
        else if (selectedPly !== null) goToPly(selectedPly <= 1 ? null : selectedPly - 1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (mistakeOnly) jumpMistake(1)
        else if (moves.length) {
          goToPly(selectedPly === null ? 1 : Math.min(moves.length, selectedPly + 1))
        }
      } else if (e.key === 'Home') {
        e.preventDefault()
        goToPly(null)
      } else if (e.key === 'End') {
        e.preventDefault()
        if (moves.length) goToPly(moves.length)
      } else if (e.key.toLowerCase() === 'f') {
        setOrientation((o) => (o === 'white' ? 'black' : 'white'))
      } else if (e.key.toLowerCase() === 'm') {
        setMistakeOnly((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const arrows =
    showBestArrow && selectedMove?.bestMoveUci ? uciToArrow(selectedMove.bestMoveUci) : []

  const canPrev = selectedPly !== null
  const canNext = selectedPly === null ? moves.length > 0 : selectedPly < moves.length

  return (
    <div className="analyze">
      {pendingPromo && (
        <PromotionPicker
          color={pendingPromo.color}
          onCancel={() => setPendingPromo(null)}
          onPick={(piece) => {
            const p = pendingPromo
            setPendingPromo(null)
            commitBoardMove(p.from, p.to, piece, p.fenBefore, p.baseMoves)
          }}
        />
      )}

      <div className="analyze__hero">
        <h1>Analyze</h1>
        <p>
          Batch-analyze PGNs, flag inaccuracies (−1.0) and mistakes (−1.5), and jump between coach
          notes.
        </p>
        <p className="opening-line" aria-live="polite">
          Opening: <strong>{opening}</strong>
        </p>
      </div>

      <GameSummary moves={moves} />

      <div className="analyze__grid">
        <div className="analyze__board-col">
          <div className="analyze__board-wrap">
            <EvalBar cp={evalCp} mate={evalMate} />
            <div className={`analyze__board ${busy ? 'is-busy' : ''}`}>
              <Chessboard
                options={{
                  position: fen,
                  onPieceDrop,
                  boardOrientation: orientation,
                  arrows,
                  boardStyle: {
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow)',
                  },
                  darkSquareStyle: { backgroundColor: '#4f6b48' },
                  lightSquareStyle: { backgroundColor: '#e8d7b5' },
                  allowDragging: !busy,
                }}
              />
            </div>
          </div>

          <BoardControls
            canPrev={canPrev}
            canNext={canNext}
            orientation={orientation}
            showBestArrow={showBestArrow}
            busy={busy}
            progress={null}
            mistakeOnly={mistakeOnly}
            mistakeCount={mistakePlies.length}
            onFirst={() => goToPly(null)}
            onPrev={() =>
              mistakeOnly
                ? jumpMistake(-1)
                : goToPly(selectedPly === null || selectedPly <= 1 ? null : selectedPly - 1)
            }
            onNext={() => {
              if (mistakeOnly) {
                jumpMistake(1)
                return
              }
              if (moves.length === 0) return
              goToPly(selectedPly === null ? 1 : Math.min(moves.length, selectedPly + 1))
            }}
            onLast={() => moves.length && goToPly(moves.length)}
            onFlip={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
            onToggleArrow={() => setShowBestArrow((v) => !v)}
            onToggleMistakeOnly={() => setMistakeOnly((v) => !v)}
            onUndo={undoLast}
            canUndo={moves.length > 0 && (selectedPly === null || selectedPly === moves.length)}
          />
        </div>

        <aside className="analyze__side">
          <MoveList moves={moves} selectedPly={selectedPly} onSelect={goToPly} />
          <EvalGraph moves={moves} selectedPly={selectedPly} onSelect={goToPly} />

          <div className="pgn-box">
            <label htmlFor="pgn">PGN</label>
            <textarea
              id="pgn"
              value={pgnText}
              onChange={(e) => setPgnText(e.target.value)}
              placeholder="1. e4 e5 2. Nf3 Nc6 ..."
              rows={4}
            />
            <div className="pgn-box__actions">
              <button type="button" onClick={() => void loadPgn()} disabled={busy}>
                {busy ? 'Analyzing…' : 'Analyze PGN'}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => void loadPgn(SAMPLE_PGN)}
                disabled={busy}
              >
                Sample
              </button>
              <button type="button" className="ghost" onClick={resetBoard} disabled={busy}>
                Reset
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => void copyAnnotated()}
                disabled={moves.length === 0}
              >
                Copy notes
              </button>
              <button type="button" className="ghost" onClick={() => void shareGame()}>
                Share
              </button>
            </div>
            {(copyMsg || shareMsg) && <p className="copy-msg">{copyMsg || shareMsg}</p>}
            <p className="hint">
              Keys: ← → · Home/End · F flip · M mistake-scrub · tiers −1.0 / −1.5
            </p>
          </div>
          {error && <p className="error">{error}</p>}
        </aside>
      </div>

      <ExplanationPanel move={selectedMove} loading={busy && moves.length === 0} />
    </div>
  )
}
