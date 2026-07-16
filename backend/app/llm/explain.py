"""Claude-powered mistake explanations (async, threshold-gated by callers)."""

from __future__ import annotations

import json
import re

import anthropic

from app.config import settings
from app.schemas import EvalScore, ExplainRequest, ExplainResponse, MistakeCategory

SYSTEM_PROMPT = """You are ChessMind, a concise chess coach.
Given a position, a played move, the eval swing, and Stockfish's best alternative,
explain why the move was a mistake in 1-3 short plain-English sentences.

Also classify the mistake into exactly one category:
- hangs_pieces
- missed_tactic
- weak_king_safety
- bad_opening_theory
- lost_tempo
- blunder_other

And estimate the game phase: opening | middlegame | endgame

Respond with ONLY valid JSON (no markdown):
{"explanation":"...","category":"hangs_pieces","phase":"opening"}
"""


def _fmt_eval(score: EvalScore) -> str:
    if score.mate is not None:
        return f"M{score.mate}"
    if score.cp is not None:
        return f"{score.cp / 100:+.2f}"
    return "unknown"


async def explain_mistake(request: ExplainRequest) -> ExplainResponse:
    if not settings.anthropic_api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Add it to your environment to enable explanations."
        )

    user_msg = f"""FEN before move: {request.fen_before}
Played move: {request.move_san or request.move_uci} ({request.move_uci})
Eval before (White POV): {_fmt_eval(request.eval_before)}
Eval after (White POV): {_fmt_eval(request.eval_after)}
Eval swing (mover POV, pawns): {request.eval_swing_cp:+.2f}
Best alternative: {request.best_move_san or request.best_move_uci or "unknown"}
Ply: {request.ply if request.ply is not None else "unknown"}
"""

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=300,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )

    text = "".join(
        block.text for block in message.content if getattr(block, "type", None) == "text"
    ).strip()

    parsed = _parse_json(text)
    category_raw = parsed.get("category", "blunder_other")
    try:
        category = MistakeCategory(category_raw)
    except ValueError:
        category = MistakeCategory.blunder_other

    phase = parsed.get("phase", "middlegame")
    if phase not in {"opening", "middlegame", "endgame"}:
        phase = "middlegame"

    explanation = str(parsed.get("explanation") or text).strip()
    return ExplainResponse(
        explanation=explanation,
        category=category,
        phase=phase,
        model=settings.anthropic_model,
    )


def _parse_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
    return {
        "explanation": text,
        "category": "blunder_other",
        "phase": "middlegame",
    }
