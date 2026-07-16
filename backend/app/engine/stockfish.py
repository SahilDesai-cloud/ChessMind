"""Stockfish analysis via python-chess, run off the event loop."""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from functools import partial
from io import StringIO

import chess
import chess.engine
import chess.pgn

from app.config import settings

_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="stockfish")


@dataclass(frozen=True)
class ScoreResult:
    cp: int | None
    mate: int | None


@dataclass(frozen=True)
class AnalysisResult:
    fen_before: str
    fen_after: str
    move_uci: str
    move_san: str
    eval_before: ScoreResult
    eval_after: ScoreResult
    eval_swing_cp: float | None
    best_move_uci: str | None
    best_move_san: str | None
    best_eval: ScoreResult | None
    depth: int


@dataclass(frozen=True)
class EngineMoveResult:
    fen_before: str
    fen_after: str
    move_uci: str
    move_san: str
    eval_after: ScoreResult
    depth: int


def _score_to_result(score: chess.engine.PovScore) -> ScoreResult:
    white = score.white()
    if white.is_mate():
        return ScoreResult(cp=None, mate=white.mate())
    return ScoreResult(cp=white.score(), mate=None)


def _swing_from_mover_pov(
    before: ScoreResult,
    after: ScoreResult,
    turn: chess.Color,
) -> float | None:
    if before.cp is None or after.cp is None:
        return None
    delta_white = after.cp - before.cp
    if turn == chess.WHITE:
        return delta_white / 100.0
    return -delta_white / 100.0


def _limit() -> chess.engine.Limit:
    if settings.stockfish_time_ms > 0:
        return chess.engine.Limit(time=settings.stockfish_time_ms / 1000.0)
    return chess.engine.Limit(depth=settings.stockfish_depth)


def _open_engine() -> chess.engine.SimpleEngine:
    try:
        return chess.engine.SimpleEngine.popen_uci(settings.stockfish_path)
    except FileNotFoundError as exc:
        raise RuntimeError(
            f"Stockfish binary not found at {settings.stockfish_path!r}. "
            "Set STOCKFISH_PATH in your environment."
        ) from exc


def _parse_move(board: chess.Board, move: str) -> chess.Move:
    move = move.strip()
    try:
        parsed = chess.Move.from_uci(move)
        if parsed in board.legal_moves:
            return parsed
    except ValueError:
        pass
    try:
        return board.parse_san(move)
    except ValueError as exc:
        raise ValueError(f"Illegal or unparseable move: {move!r}") from exc


def _analyze_on_engine(
    engine: chess.engine.SimpleEngine,
    fen: str,
    move: str,
) -> AnalysisResult:
    try:
        board = chess.Board(fen)
    except ValueError as exc:
        raise ValueError(f"Invalid FEN: {fen!r}") from exc

    mover_turn = board.turn
    parsed = _parse_move(board, move)
    move_san = board.san(parsed)
    move_uci = parsed.uci()
    limit = _limit()
    depth_used = settings.stockfish_depth

    info_before = engine.analyse(board, limit)
    eval_before = _score_to_result(info_before["score"])
    best_move: chess.Move | None = info_before.get("pv", [None])[0]
    best_move_uci = best_move.uci() if best_move else None
    best_move_san = board.san(best_move) if best_move else None

    best_eval: ScoreResult | None = None
    if best_move is not None:
        board_best = board.copy()
        board_best.push(best_move)
        info_best = engine.analyse(board_best, limit)
        best_eval = _score_to_result(info_best["score"])

    board.push(parsed)
    fen_after = board.fen()
    info_after = engine.analyse(board, limit)
    eval_after = _score_to_result(info_after["score"])
    if "depth" in info_after:
        depth_used = int(info_after["depth"])

    swing = _swing_from_mover_pov(eval_before, eval_after, mover_turn)
    return AnalysisResult(
        fen_before=fen,
        fen_after=fen_after,
        move_uci=move_uci,
        move_san=move_san,
        eval_before=eval_before,
        eval_after=eval_after,
        eval_swing_cp=swing,
        best_move_uci=best_move_uci,
        best_move_san=best_move_san,
        best_eval=best_eval,
        depth=depth_used,
    )


def _analyze_sync(fen: str, move: str) -> AnalysisResult:
    engine = _open_engine()
    try:
        return _analyze_on_engine(engine, fen, move)
    finally:
        engine.quit()


def _analyze_pgn_sync(pgn: str) -> list[AnalysisResult]:
    game = chess.pgn.read_game(StringIO(pgn))
    if game is None:
        raise ValueError("Invalid or empty PGN")

    board = game.board()
    engine = _open_engine()
    results: list[AnalysisResult] = []
    try:
        for move in game.mainline_moves():
            fen_before = board.fen()
            results.append(_analyze_on_engine(engine, fen_before, move.uci()))
            board.push(move)
    finally:
        engine.quit()
    return results


def _best_move_sync(fen: str) -> EngineMoveResult:
    try:
        board = chess.Board(fen)
    except ValueError as exc:
        raise ValueError(f"Invalid FEN: {fen!r}") from exc

    if board.is_game_over():
        raise ValueError("Game is already over")

    engine = _open_engine()
    limit = _limit()
    try:
        play = engine.play(board, limit)
        move = play.move
        if move is None:
            raise RuntimeError("Stockfish returned no move")
        move_san = board.san(move)
        move_uci = move.uci()
        board.push(move)
        info = engine.analyse(board, limit)
        eval_after = _score_to_result(info["score"])
        depth_used = int(info.get("depth", settings.stockfish_depth))
    finally:
        engine.quit()

    return EngineMoveResult(
        fen_before=fen,
        fen_after=board.fen(),
        move_uci=move_uci,
        move_san=move_san,
        eval_after=eval_after,
        depth=depth_used,
    )


async def analyze_position(fen: str, move: str) -> AnalysisResult:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, partial(_analyze_sync, fen, move))


async def analyze_pgn(pgn: str) -> list[AnalysisResult]:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, partial(_analyze_pgn_sync, pgn))


async def engine_reply(fen: str) -> EngineMoveResult:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, partial(_best_move_sync, fen))
