from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class MistakeCategory(str, Enum):
    hangs_pieces = "hangs_pieces"
    missed_tactic = "missed_tactic"
    weak_king_safety = "weak_king_safety"
    bad_opening_theory = "bad_opening_theory"
    lost_tempo = "lost_tempo"
    blunder_other = "blunder_other"


class Severity(str, Enum):
    ok = "ok"
    inaccuracy = "inaccuracy"
    mistake = "mistake"


class AnalyzeRequest(BaseModel):
    fen: str = Field(
        ...,
        description="FEN of the position BEFORE the move is played",
        examples=["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"],
    )
    move: str = Field(
        ...,
        description="Move in UCI (e2e4) or SAN (e4)",
        examples=["e2e4"],
    )


class EvalScore(BaseModel):
    cp: int | None = Field(None, description="Centipawn score (positive = White better).")
    mate: int | None = Field(None, description="Mate in N (positive = White mates).")


class AnalyzeResponse(BaseModel):
    fen_before: str
    fen_after: str
    move_uci: str
    move_san: str
    eval_before: EvalScore
    eval_after: EvalScore
    eval_swing_cp: float | None = None
    best_move_uci: str | None = None
    best_move_san: str | None = None
    best_eval: EvalScore | None = None
    depth: int
    severity: Severity = Severity.ok


class ExplainRequest(BaseModel):
    fen_before: str
    move_uci: str
    move_san: str | None = None
    eval_before: EvalScore
    eval_after: EvalScore
    eval_swing_cp: float
    best_move_uci: str | None = None
    best_move_san: str | None = None
    ply: int | None = None


class ExplainResponse(BaseModel):
    explanation: str
    category: MistakeCategory
    phase: str
    model: str


class CreateGameRequest(BaseModel):
    user_id: str = "default"
    pgn: str | None = None
    white: str | None = None
    black: str | None = None
    result: str | None = None


class GameResponse(BaseModel):
    id: str
    user_id: str
    pgn: str | None
    white: str | None
    black: str | None
    result: str | None

    model_config = {"from_attributes": True}


class AnalyzeMoveRequest(BaseModel):
    fen: str
    move: str
    ply: int
    user_id: str = "default"
    game_id: str | None = None
    persist: bool = True
    explain: bool = True


class MistakeResponse(BaseModel):
    id: str
    category: MistakeCategory
    explanation: str
    eval_swing_cp: float
    phase: str

    model_config = {"from_attributes": True}


class AnalyzeMoveResponse(BaseModel):
    analysis: AnalyzeResponse
    explained: bool
    explanation: ExplainResponse | None = None
    game_id: str | None = None
    move_id: str | None = None
    mistake: MistakeResponse | None = None


class AnalyzePgnRequest(BaseModel):
    pgn: str
    user_id: str = "default"
    persist: bool = True
    explain: bool = True


class AnalyzePgnMove(BaseModel):
    ply: int
    analysis: AnalyzeResponse
    explained: bool
    explanation: ExplainResponse | None = None
    mistake: MistakeResponse | None = None


class AnalyzePgnResponse(BaseModel):
    game_id: str | None
    opening: str | None
    moves: list[AnalyzePgnMove]
    mistake_count: int
    inaccuracy_count: int


class EngineMoveRequest(BaseModel):
    fen: str


class EngineMoveResponse(BaseModel):
    fen_before: str
    fen_after: str
    move_uci: str
    move_san: str
    eval_after: EvalScore
    depth: int


class OpeningRequest(BaseModel):
    moves_uci: list[str] = Field(default_factory=list)


class OpeningResponse(BaseModel):
    name: str
    eco_moves: str | None = None


class CategoryStat(BaseModel):
    category: MistakeCategory
    count: int
    percentage: float
    by_phase: dict[str, int]


class CoachStatsResponse(BaseModel):
    user_id: str
    total_mistakes: int
    total_games: int
    categories: list[CategoryStat]
    top_insight: str | None = None


class ThresholdsResponse(BaseModel):
    inaccuracy_threshold: float
    mistake_threshold: float
    explain_eval_threshold: float
