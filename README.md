# ChessMind

Chess move explainer: Stockfish evals + Claude explanations + coach stats + play vs engine.

## Stack

- **Frontend** — React (Vite) → Vercel
- **Backend** — FastAPI + Stockfish + Anthropic → Render
- **DB** — PostgreSQL

## Features

- Batch `/analyze-pgn` (one Stockfish process for the whole game)
- Severity tiers: inaccuracy (−1.0) / mistake (−1.5)
- Claude for mistakes when `ANTHROPIC_API_KEY` is set; **fallback notes always stored** so Coach still works
- Opening name detection
- Play vs engine (`/play`)
- Promotion picker, share links (`#s=…`), mistake-only scrubber
- Coach dashboard with phase filters

## Quick start (Docker)

```bash
# 1) Start Docker Desktop
# 2) Copy env and set your Anthropic key (optional but recommended)
cp .env.example .env
# edit ANTHROPIC_API_KEY=

docker compose up --build
```

API: http://localhost:8000  
Docs: http://localhost:8000/docs

## Local development

### Backend

```bash
cd backend
# from repo root: .venv already created
..\ .venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env
# Set STOCKFISH_PATH, ANTHROPIC_API_KEY, DATABASE_URL

docker compose up -d db
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

UI: http://127.0.0.1:5173

## API overview

| Endpoint | Purpose |
|----------|---------|
| `POST /analyze` | FEN + move → Stockfish eval |
| `POST /analyze-move` | Analyze → explain/fallback → persist |
| `POST /analyze-pgn` | Batch-analyze a full PGN |
| `POST /explain` | Claude explanation only |
| `POST /engine-move` | Stockfish best reply (play mode) |
| `POST /opening` | Opening name from UCI moves |
| `GET /thresholds` | Inaccuracy / mistake cutoffs |
| `GET /coach/stats` | Mistake category aggregates |

## Deploy

- **Frontend (Vercel):** project root `frontend/`, set `VITE_API_URL` to the Render API URL.
- **Backend (Render):** use `render.yaml` or Docker from `backend/Dockerfile`. Set `ANTHROPIC_API_KEY`, attach Postgres, `STOCKFISH_PATH=/usr/games/stockfish`.
