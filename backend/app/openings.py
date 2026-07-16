"""Common opening names keyed by UCI move sequences (longest match wins)."""

from __future__ import annotations

# Compact ECO-ish book for the first ~8–12 plies of popular lines.
OPENINGS: dict[str, str] = {
    "e2e4": "King's Pawn Opening",
    "e2e4 e7e5": "Open Game",
    "e2e4 e7e5 g1f3": "Open Game",
    "e2e4 e7e5 g1f3 b8c6": "Open Game",
    "e2e4 e7e5 g1f3 b8c6 f1b5": "Ruy Lopez",
    "e2e4 e7e5 g1f3 b8c6 f1c4": "Italian Game",
    "e2e4 e7e5 g1f3 b8c6 d2d4": "Scotch Game",
    "e2e4 e7e5 g1f3 g8f6": "Petrov Defense",
    "e2e4 e7e5 f2f4": "King's Gambit",
    "e2e4 c7c5": "Sicilian Defense",
    "e2e4 c7c5 g1f3": "Sicilian Defense",
    "e2e4 c7c5 g1f3 d7d6": "Sicilian Defense",
    "e2e4 c7c5 g1f3 d7d6 d2d4": "Open Sicilian",
    "e2e4 c7c5 g1f3 e7e6": "Sicilian, French Variation",
    "e2e4 c7c5 g1f3 b8c6": "Sicilian Defense",
    "e2e4 c7c6": "Caro-Kann Defense",
    "e2e4 c7c6 d2d4 d7d5": "Caro-Kann Defense",
    "e2e4 e7e6": "French Defense",
    "e2e4 e7e6 d2d4 d7d5": "French Defense",
    "e2e4 d7d5": "Scandinavian Defense",
    "e2e4 g8f6": "Alekhine Defense",
    "e2e4 g7g6": "Modern Defense",
    "e2e4 d7d6": "Pirc Defense",
    "d2d4": "Queen's Pawn Opening",
    "d2d4 d7d5": "Queen's Pawn Game",
    "d2d4 d7d5 c2c4": "Queen's Gambit",
    "d2d4 d7d5 c2c4 e7e6": "Queen's Gambit Declined",
    "d2d4 d7d5 c2c4 c7c6": "Slav Defense",
    "d2d4 d7d5 c2c4 d5c4": "Queen's Gambit Accepted",
    "d2d4 g8f6": "Indian Defense",
    "d2d4 g8f6 c2c4": "Indian Defense",
    "d2d4 g8f6 c2c4 g7g6": "King's Indian Defense",
    "d2d4 g8f6 c2c4 e7e6": "Nimzo/Queen's Indian setup",
    "d2d4 g8f6 c2c4 e7e6 b1c3 f8b4": "Nimzo-Indian Defense",
    "d2d4 g8f6 c2c4 c7c5": "Benoni Defense",
    "d2d4 f7f5": "Dutch Defense",
    "c2c4": "English Opening",
    "c2c4 e7e5": "English Opening",
    "g1f3": "Réti Opening",
    "g1f3 d7d5": "Réti Opening",
    "g2g3": "Hungarian Opening",
    "b2b3": "Nimzo-Larsen Attack",
    "f2f4": "Bird Opening",
    "e2e4 e7e5 d1h5": "Scholar's Mate attempt",
    "e2e4 e7e5 d1h5 b8c6 f1c4": "Scholar's Mate attempt",
}


def opening_from_uci_moves(uci_moves: list[str]) -> dict[str, str | None]:
    """Return the longest matching opening name for a UCI move list."""
    best_name: str | None = None
    best_key = ""
    joined_parts: list[str] = []
    for move in uci_moves:
        joined_parts.append(move)
        key = " ".join(joined_parts)
        if key in OPENINGS:
            best_name = OPENINGS[key]
            best_key = key
    return {
        "name": best_name or ("Unknown opening" if uci_moves else "Starting position"),
        "eco_moves": best_key or None,
    }
