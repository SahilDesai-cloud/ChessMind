import { useCallback, useEffect, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { analyzeMove, engineMove, getOpening } from '../api/client'
import type { MoveAnnotation } from '../api/types'
import { EvalBar } from '../components/EvalBar'
import { ExplanationPanel } from '../components/ExplanationPanel'
import { MoveList } from '../components/MoveList'
import { PromotionPicker } from '../components/PromotionPicker'
import { START_FEN, annotationFromAnalysis, uciToArrow } from '../lib/chessHelpers'
import { writeShareToLocation } from '../lib/share'
import './PlayPage.css'

type PendingPromotion = {
  from: Square
  to: Square
  color: 'w' | 'b'
}

export function PlayPage() {
  const [game] = useState(() => new Chess())
  const [fen, setFen] = useState(START_FEN)
  const [moves, setMoves] = useState<MoveAnnotation[]>([])
  const [selectedPly, setSelectedPly] = useState<number | null>(null)
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [evalCp, setEvalCp] = useState<number | null>(40)
  const [evalMate, setEvalMate] = useState<number | null>(null)
  const [opening, setOpening] = useState('Starting position')
  const [status, setStatus] = useState('Your move')
  const [pendingPromo, setPendingPromo] = useState<PendingPromotion | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [showBest, setShowBest] = useState(true)

  const selectedMove = moves.find((m) => m.ply === selectedPly) ?? null
  const orientation = playerColor

  const refreshOpening = async (list: MoveAnnotation[]) => {
    try {
      const res = await getOpening(list.map((m) => m.uci))
      setOpening(res.name)
    } catch {
      setOpening(list.length ? 'Unknown opening' : 'Starting position')
    }
  }

  const reset = (color: 'white' | 'black' = playerColor) => {
    game.reset()
    setFen(START_FEN)
    setMoves([])
    setSelectedPly(null)
    setGameId(null)
    setEvalCp(40)
    setEvalMate(null)
    setError(null)
    setOpening('Starting position')
    setPendingPromo(null)
    setPlayerColor(color)
    setStatus(color === 'white' ? 'Your move' : 'Engine thinking…')
    if (color === 'black') {
      void runEngineTurn(START_FEN, [], null)
    }
  }

  const appendAnalysis = async (
    fenBefore: string,
    lan: string,
    ply: number,
    currentId: string | null,
    list: MoveAnnotation[],
  ) => {
    const result = await analyzeMove({
      fen: fenBefore,
      move: lan,
      ply,
      game_id: currentId,
      persist: true,
    })
    const annotation = annotationFromAnalysis(
      ply,
      result.analysis,
      result.explanation?.explanation ?? result.mistake?.explanation ?? null,
      result.explanation?.category ?? result.mistake?.category ?? null,
      result.explained,
    )
    const next = [...list, annotation]
    setMoves(next)
    setSelectedPly(ply)
    setEvalCp(result.analysis.eval_after.cp)
    setEvalMate(result.analysis.eval_after.mate)
    await refreshOpening(next)
    return { next, gameId: result.game_id ?? currentId, annotation }
  }

  const runEngineTurn = async (
    fenNow: string,
    list: MoveAnnotation[],
    currentId: string | null,
  ) => {
    setBusy(true)
    setStatus('Engine thinking…')
    try {
      const reply = await engineMove(fenNow)
      game.load(reply.fen_after)
      setFen(reply.fen_after)
      const { next, gameId: gid } = await appendAnalysis(
        reply.fen_before,
        reply.move_uci,
        list.length + 1,
        currentId,
        list,
      )
      setGameId(gid)
      if (game.isGameOver()) {
        setStatus(gameStatus())
      } else {
        setStatus('Your move')
      }
      return { next, gid }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Engine move failed')
      setStatus('Engine error')
      return { next: list, gid: currentId }
    } finally {
      setBusy(false)
    }
  }

  const gameStatus = () => {
    if (game.isCheckmate()) return 'Checkmate'
    if (game.isDraw()) return 'Draw'
    if (game.isStalemate()) return 'Stalemate'
    return 'Game over'
  }

  const playUserMove = async (from: Square, to: Square, promotion: 'q' | 'r' | 'b' | 'n') => {
    if (busy) return
    const turn = game.turn() === 'w' ? 'white' : 'black'
    if (turn !== playerColor) return

    const fenBefore = game.fen()
    const move = game.move({ from, to, promotion })
    if (!move) return

    setFen(game.fen())
    setBusy(true)
    setError(null)
    try {
      const { next, gameId: gid } = await appendAnalysis(
        fenBefore,
        move.lan,
        moves.length + 1,
        gameId,
        moves,
      )
      setGameId(gid)
      if (game.isGameOver()) {
        setStatus(gameStatus())
        return
      }
      await runEngineTurn(game.fen(), next, gid)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Move failed')
      game.undo()
      setFen(game.fen())
    } finally {
      setBusy(false)
    }
  }

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
      if (!targetSquare || busy) return false
      const from = sourceSquare as Square
      const to = targetSquare as Square
      const piece = game.get(from)
      if (!piece) return false
      const turn = game.turn() === 'w' ? 'white' : 'black'
      if (turn !== playerColor) return false

      const isPromo =
        piece.type === 'p' &&
        ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'))

      if (isPromo) {
        const testBoard = new Chess(game.fen())
        const test = testBoard.move({ from, to, promotion: 'q' })
        if (!test) return false
        setPendingPromo({ from, to, color: piece.color })
        return false
      }

      // Validate without committing; playUserMove owns the real push.
      const testBoard = new Chess(game.fen())
      if (!testBoard.move({ from, to })) return false
      void playUserMove(from, to, 'q')
      return false
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, game, playerColor, moves, gameId],
  )

  const sharePosition = async () => {
    const url = writeShareToLocation({ v: 1, fen, mode: 'play' })
    try {
      await navigator.clipboard.writeText(url)
      setStatus('Share link copied')
    } catch {
      setStatus(url)
    }
  }

  useEffect(() => {
    // ensure status sync
  }, [])

  const arrows =
    showBest && selectedMove?.bestMoveUci ? uciToArrow(selectedMove.bestMoveUci) : []

  return (
    <div className="play">
      {pendingPromo && (
        <PromotionPicker
          color={pendingPromo.color}
          onCancel={() => setPendingPromo(null)}
          onPick={(piece) => {
            const p = pendingPromo
            setPendingPromo(null)
            void playUserMove(p.from, p.to, piece)
          }}
        />
      )}

      <header className="play__hero">
        <h1>Play vs Engine</h1>
        <p>Make a move — Stockfish replies. Your moves are still scored for coach notes.</p>
        <p className="opening-line">
          Opening: <strong>{opening}</strong>
        </p>
      </header>

      <div className="play__toolbar">
        <button type="button" onClick={() => reset('white')} disabled={busy}>
          Play White
        </button>
        <button type="button" onClick={() => reset('black')} disabled={busy}>
          Play Black
        </button>
        <button type="button" className="ghost" onClick={() => setShowBest((v) => !v)}>
          {showBest ? 'Hide best arrow' : 'Show best arrow'}
        </button>
        <button type="button" className="ghost" onClick={() => void sharePosition()}>
          Share position
        </button>
        <span className="play__status">{status}</span>
      </div>

      <div className="play__grid">
        <div className="play__board-wrap">
          <EvalBar cp={evalCp} mate={evalMate} />
          <div className={`play__board ${busy ? 'is-busy' : ''}`}>
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
        <aside className="play__side">
          <MoveList
            moves={moves}
            selectedPly={selectedPly}
            onSelect={(ply) => {
              const m = moves.find((x) => x.ply === ply)
              if (!m) return
              setSelectedPly(ply)
              setFen(m.fenAfter)
              setEvalCp(m.evalAfterCp)
              setEvalMate(m.evalAfterMate)
            }}
          />
          {error && <p className="error">{error}</p>}
        </aside>
      </div>

      <ExplanationPanel move={selectedMove} loading={false} />
    </div>
  )
}
