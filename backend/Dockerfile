FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    stockfish \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV STOCKFISH_PATH=/usr/games/stockfish
ENV STOCKFISH_DEPTH=15
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE 8000

# Render injects $PORT — must bind to it.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
