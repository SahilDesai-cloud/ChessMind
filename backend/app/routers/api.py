from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.engine.stockfish import analyze_pgn, analyze_position, engine_reply
from app.llm.explain import explain_mistake
from app.models import Game, Mistake, MistakeCategory as DbCategory, Move
from app.openings import opening_from_uci_moves
from app.schemas import (
    AnalyzeMoveRequest,
    AnalyzeMoveResponse,
    AnalyzePgnMove,
    AnalyzePgnRequest,
    AnalyzePgnResponse,
    AnalyzeRequest,
    AnalyzeResponse,
    CategoryStat,
    CoachStatsResponse,
    CreateGameRequest,
    EngineMoveRequest,
    EngineMoveResponse,
    EvalScore,
    ExplainRequest,
    ExplainResponse,
    GameResponse,
    MistakeCategory,
    MistakeResponse,
    OpeningRequest,
    OpeningResponse,
    Severity,
    ThresholdsResponse,
)

router = APIRouter()


def classify_severity(swing: float | None) -> Severity:
    if swing is None:
        return Severity.ok
    if swing <= settings.mistake_threshold:
        return Severity.mistake
    if swing <= settings.inaccuracy_threshold:
        return Severity.inaccuracy
    return Severity.ok


def estimate_phase(ply: int | None) -> str:
    if ply is None:
        return "middlegame"
    if ply <= 20:
        return "opening"
    if ply <= 40:
        return "middlegame"
    return "endgame"


def fallback_explanation(
    analysis: AnalyzeResponse,
    ply: int | None,
) -> ExplainResponse:
    best = analysis.best_move_san or analysis.best_move_uci or "another move"
    swing = analysis.eval_swing_cp if analysis.eval_swing_cp is not None else 0.0
    tier = "mistake" if analysis.severity == Severity.mistake else "inaccuracy"
    text = (
        f"This looks like a {tier} (eval swing {swing:+.2f}). "
        f"Stockfish preferred {best} from the prior position."
    )
    category = (
        MistakeCategory.bad_opening_theory
        if (ply or 0) <= 16
        else MistakeCategory.blunder_other
    )
    return ExplainResponse(
        explanation=text,
        category=category,
        phase=estimate_phase(ply),
        model="fallback",
    )


def _to_analyze_response(result) -> AnalyzeResponse:
    swing = result.eval_swing_cp
    return AnalyzeResponse(
        fen_before=result.fen_before,
        fen_after=result.fen_after,
        move_uci=result.move_uci,
        move_san=result.move_san,
        eval_before=EvalScore(cp=result.eval_before.cp, mate=result.eval_before.mate),
        eval_after=EvalScore(cp=result.eval_after.cp, mate=result.eval_after.mate),
        eval_swing_cp=swing,
        best_move_uci=result.best_move_uci,
        best_move_san=result.best_move_san,
        best_eval=(
            EvalScore(cp=result.best_eval.cp, mate=result.best_eval.mate)
            if result.best_eval
            else None
        ),
        depth=result.depth,
        severity=classify_severity(swing),
    )


async def _maybe_explain(
    analysis: AnalyzeResponse,
    ply: int | None,
    *,
    explain: bool,
) -> tuple[ExplainResponse | None, bool]:
    """LLM for mistakes; fallback text always when swing is flagged."""
    if analysis.severity == Severity.ok:
        return None, False

    explanation: ExplainResponse | None = None
    explained = False

    should_llm = (
        explain
        and analysis.severity == Severity.mistake
        and analysis.eval_swing_cp is not None
        and analysis.eval_swing_cp <= settings.explain_eval_threshold
    )

    if should_llm:
        try:
            explanation = await explain_mistake(
                ExplainRequest(
                    fen_before=analysis.fen_before,
                    move_uci=analysis.move_uci,
                    move_san=analysis.move_san,
                    eval_before=analysis.eval_before,
                    eval_after=analysis.eval_after,
                    eval_swing_cp=analysis.eval_swing_cp or 0.0,
                    best_move_uci=analysis.best_move_uci,
                    best_move_san=analysis.best_move_san,
                    ply=ply,
                )
            )
            explained = True
        except Exception:
            explanation = None
            explained = False

    if explanation is None:
        explanation = fallback_explanation(analysis, ply)
        explained = False

    return explanation, explained


async def _persist_move(
    db: AsyncSession,
    *,
    user_id: str,
    game_id: str | None,
    ply: int,
    analysis: AnalyzeResponse,
    explanation: ExplainResponse | None,
) -> tuple[str | None, Move | None, Mistake | None]:
    move_row: Move | None = None
    mistake_row: Mistake | None = None
    try:
        if not game_id:
            game = Game(user_id=user_id)
            db.add(game)
            await db.flush()
            game_id = game.id
        else:
            existing = await db.get(Game, game_id)
            if existing is None:
                raise HTTPException(status_code=404, detail="Game not found")

        move_row = Move(
            game_id=game_id,
            ply=ply,
            move_uci=analysis.move_uci,
            move_san=analysis.move_san,
            fen_before=analysis.fen_before,
            fen_after=analysis.fen_after,
            eval_before_cp=analysis.eval_before.cp,
            eval_after_cp=analysis.eval_after.cp,
            eval_swing_cp=analysis.eval_swing_cp,
            best_move_uci=analysis.best_move_uci,
        )
        db.add(move_row)
        await db.flush()

        # Persist flagged swings even without LLM (fallback explanation).
        if (
            explanation is not None
            and analysis.eval_swing_cp is not None
            and analysis.severity != Severity.ok
        ):
            mistake_row = Mistake(
                game_id=game_id,
                move_id=move_row.id,
                user_id=user_id,
                category=DbCategory(explanation.category.value),
                explanation=explanation.explanation,
                eval_swing_cp=analysis.eval_swing_cp,
                phase=explanation.phase,
            )
            db.add(mistake_row)

        await db.commit()
        if move_row:
            await db.refresh(move_row)
        if mistake_row:
            await db.refresh(mistake_row)
    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        print(f"Warning: failed to persist move: {exc}")
        return game_id, None, None

    return game_id, move_row, mistake_row


def _mistake_response(row: Mistake | None) -> MistakeResponse | None:
    if row is None:
        return None
    return MistakeResponse(
        id=row.id,
        category=MistakeCategory(row.category.value),
        explanation=row.explanation,
        eval_swing_cp=row.eval_swing_cp,
        phase=row.phase,
    )


@router.get("/thresholds", response_model=ThresholdsResponse)
async def thresholds() -> ThresholdsResponse:
    return ThresholdsResponse(
        inaccuracy_threshold=settings.inaccuracy_threshold,
        mistake_threshold=settings.mistake_threshold,
        explain_eval_threshold=settings.explain_eval_threshold,
    )


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    try:
        result = await analyze_position(request.fen, request.move)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return _to_analyze_response(result)


@router.post("/explain", response_model=ExplainResponse)
async def explain(request: ExplainRequest) -> ExplainResponse:
    try:
        return await explain_mistake(request)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Claude API error: {exc}") from exc


@router.post("/opening", response_model=OpeningResponse)
async def opening(request: OpeningRequest) -> OpeningResponse:
    data = opening_from_uci_moves(request.moves_uci)
    return OpeningResponse(name=str(data["name"]), eco_moves=data["eco_moves"])


@router.post("/engine-move", response_model=EngineMoveResponse)
async def engine_move(request: EngineMoveRequest) -> EngineMoveResponse:
    try:
        result = await engine_reply(request.fen)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return EngineMoveResponse(
        fen_before=result.fen_before,
        fen_after=result.fen_after,
        move_uci=result.move_uci,
        move_san=result.move_san,
        eval_after=EvalScore(cp=result.eval_after.cp, mate=result.eval_after.mate),
        depth=result.depth,
    )


@router.post("/games", response_model=GameResponse)
async def create_game(
    request: CreateGameRequest,
    db: AsyncSession = Depends(get_db),
) -> GameResponse:
    game = Game(
        user_id=request.user_id,
        pgn=request.pgn,
        white=request.white,
        black=request.black,
        result=request.result,
    )
    db.add(game)
    await db.commit()
    await db.refresh(game)
    return GameResponse.model_validate(game)


@router.get("/games", response_model=list[GameResponse])
async def list_games(
    user_id: str = "default",
    db: AsyncSession = Depends(get_db),
) -> list[GameResponse]:
    result = await db.execute(
        select(Game).where(Game.user_id == user_id).order_by(Game.created_at.desc())
    )
    return [GameResponse.model_validate(g) for g in result.scalars().all()]


@router.post("/analyze-move", response_model=AnalyzeMoveResponse)
async def analyze_move(
    request: AnalyzeMoveRequest,
    db: AsyncSession = Depends(get_db),
) -> AnalyzeMoveResponse:
    try:
        result = await analyze_position(request.fen, request.move)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    analysis = _to_analyze_response(result)
    explanation, explained = await _maybe_explain(
        analysis, request.ply, explain=request.explain
    )

    move_row = None
    mistake_row = None
    game_id = request.game_id
    if request.persist:
        game_id, move_row, mistake_row = await _persist_move(
            db,
            user_id=request.user_id,
            game_id=game_id,
            ply=request.ply,
            analysis=analysis,
            explanation=explanation,
        )

    return AnalyzeMoveResponse(
        analysis=analysis,
        explained=explained,
        explanation=explanation,
        game_id=game_id,
        move_id=move_row.id if move_row else None,
        mistake=_mistake_response(mistake_row),
    )


@router.post("/analyze-pgn", response_model=AnalyzePgnResponse)
async def analyze_pgn_endpoint(
    request: AnalyzePgnRequest,
    db: AsyncSession = Depends(get_db),
) -> AnalyzePgnResponse:
    try:
        results = await analyze_pgn(request.pgn)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    uci_moves = [r.move_uci for r in results]
    opening = opening_from_uci_moves(uci_moves)["name"]

    game_id: str | None = None
    if request.persist:
        try:
            game = Game(user_id=request.user_id, pgn=request.pgn)
            db.add(game)
            await db.commit()
            await db.refresh(game)
            game_id = game.id
        except Exception as exc:
            await db.rollback()
            print(f"Warning: failed to create game: {exc}")
            game_id = None

    moves_out: list[AnalyzePgnMove] = []
    mistake_count = 0
    inaccuracy_count = 0

    for i, result in enumerate(results):
        ply = i + 1
        analysis = _to_analyze_response(result)
        if analysis.severity == Severity.mistake:
            mistake_count += 1
        elif analysis.severity == Severity.inaccuracy:
            inaccuracy_count += 1

        explanation, explained = await _maybe_explain(
            analysis, ply, explain=request.explain
        )

        mistake_row = None
        if request.persist and game_id:
            _, _, mistake_row = await _persist_move(
                db,
                user_id=request.user_id,
                game_id=game_id,
                ply=ply,
                analysis=analysis,
                explanation=explanation,
            )

        moves_out.append(
            AnalyzePgnMove(
                ply=ply,
                analysis=analysis,
                explained=explained,
                explanation=explanation if analysis.severity != Severity.ok else None,
                mistake=_mistake_response(mistake_row),
            )
        )

    return AnalyzePgnResponse(
        game_id=game_id,
        opening=str(opening) if opening else None,
        moves=moves_out,
        mistake_count=mistake_count,
        inaccuracy_count=inaccuracy_count,
    )


@router.get("/coach/stats", response_model=CoachStatsResponse)
async def coach_stats(
    user_id: str = "default",
    db: AsyncSession = Depends(get_db),
) -> CoachStatsResponse:
    games_count = await db.scalar(
        select(func.count()).select_from(Game).where(Game.user_id == user_id)
    )
    mistakes = (
        await db.execute(select(Mistake).where(Mistake.user_id == user_id))
    ).scalars().all()

    total = len(mistakes)
    by_cat: dict[str, int] = {}
    by_cat_phase: dict[str, dict[str, int]] = {}

    for m in mistakes:
        key = m.category.value
        by_cat[key] = by_cat.get(key, 0) + 1
        by_cat_phase.setdefault(key, {})
        by_cat_phase[key][m.phase] = by_cat_phase[key].get(m.phase, 0) + 1

    categories = [
        CategoryStat(
            category=MistakeCategory(cat),
            count=count,
            percentage=round((count / total) * 100, 1) if total else 0.0,
            by_phase=by_cat_phase.get(cat, {}),
        )
        for cat, count in sorted(by_cat.items(), key=lambda x: -x[1])
    ]

    top_insight = None
    if categories:
        top = categories[0]
        phase_hint = ""
        if top.by_phase:
            top_phase = max(top.by_phase.items(), key=lambda x: x[1])[0]
            phase_hint = f" in the {top_phase}"
        label = top.category.value.replace("_", " ")
        top_insight = (
            f"You {label}{phase_hint} {top.percentage}% of the time "
            f"across flagged mistakes."
        )

    return CoachStatsResponse(
        user_id=user_id,
        total_mistakes=total,
        total_games=int(games_count or 0),
        categories=categories,
        top_insight=top_insight,
    )
