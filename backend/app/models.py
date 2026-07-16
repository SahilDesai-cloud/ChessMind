from __future__ import annotations

import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class MistakeCategory(str, enum.Enum):
    hangs_pieces = "hangs_pieces"
    missed_tactic = "missed_tactic"
    weak_king_safety = "weak_king_safety"
    bad_opening_theory = "bad_opening_theory"
    lost_tempo = "lost_tempo"
    blunder_other = "blunder_other"


class Game(Base):
    __tablename__ = "games"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    user_id: Mapped[str] = mapped_column(String(128), index=True, default="default")
    pgn: Mapped[str | None] = mapped_column(Text, nullable=True)
    white: Mapped[str | None] = mapped_column(String(128), nullable=True)
    black: Mapped[str | None] = mapped_column(String(128), nullable=True)
    result: Mapped[str | None] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    moves: Mapped[list[Move]] = relationship(
        back_populates="game", cascade="all, delete-orphan"
    )
    mistakes: Mapped[list[Mistake]] = relationship(
        back_populates="game", cascade="all, delete-orphan"
    )


class Move(Base):
    __tablename__ = "moves"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    game_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("games.id", ondelete="CASCADE"), index=True
    )
    ply: Mapped[int] = mapped_column(Integer)
    move_uci: Mapped[str] = mapped_column(String(16))
    move_san: Mapped[str] = mapped_column(String(16))
    fen_before: Mapped[str] = mapped_column(Text)
    fen_after: Mapped[str] = mapped_column(Text)
    eval_before_cp: Mapped[int | None] = mapped_column(Integer, nullable=True)
    eval_after_cp: Mapped[int | None] = mapped_column(Integer, nullable=True)
    eval_swing_cp: Mapped[float | None] = mapped_column(Float, nullable=True)
    best_move_uci: Mapped[str | None] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    game: Mapped[Game] = relationship(back_populates="moves")
    mistake: Mapped[Mistake | None] = relationship(
        back_populates="move", uselist=False, cascade="all, delete-orphan"
    )


class Mistake(Base):
    __tablename__ = "mistakes"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    game_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("games.id", ondelete="CASCADE"), index=True
    )
    move_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("moves.id", ondelete="CASCADE"), unique=True
    )
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    category: Mapped[MistakeCategory] = mapped_column(
        Enum(MistakeCategory, name="mistake_category"), index=True
    )
    explanation: Mapped[str] = mapped_column(Text)
    eval_swing_cp: Mapped[float] = mapped_column(Float)
    phase: Mapped[str] = mapped_column(String(32), default="middlegame")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    game: Mapped[Game] = relationship(back_populates="mistakes")
    move: Mapped[Move] = relationship(back_populates="mistake")
