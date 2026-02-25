#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# --- Prerequisites ---
command -v node  >/dev/null || err "node not found. Install Node.js >= 20"
command -v pnpm  >/dev/null || { warn "pnpm not found, enabling via corepack..."; corepack enable && corepack prepare pnpm@9.15.0 --activate; }
command -v docker >/dev/null || err "docker not found. Install Docker"

# --- .env ---
if [ ! -f .env ]; then
  cp .env.example .env
  warn ".env created from .env.example — edit BOT_TOKEN and WEBAPP_URL before using the bot"
fi

# Export all vars from .env so child processes (turbo/tsx) see them
set -a
source .env 2>/dev/null || true
set +a

# --- PostgreSQL ---
PG_CONTAINER="hellenic-pg"
PG_PASSWORD="${POSTGRES_PASSWORD:-hellenic}"

if docker ps --format '{{.Names}}' | grep -q "^${PG_CONTAINER}$"; then
  log "PostgreSQL already running"
elif docker ps -a --format '{{.Names}}' | grep -q "^${PG_CONTAINER}$"; then
  log "Starting existing PostgreSQL container..."
  docker start "$PG_CONTAINER"
else
  log "Creating PostgreSQL container..."
  docker run -d --name "$PG_CONTAINER" \
    -e POSTGRES_DB=hellenic \
    -e POSTGRES_USER=hellenic \
    -e POSTGRES_PASSWORD="$PG_PASSWORD" \
    -p 5432:5432 \
    postgres:16-alpine
fi

# Wait for PostgreSQL to be ready
log "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  if docker exec "$PG_CONTAINER" pg_isready -U hellenic -q 2>/dev/null; then
    break
  fi
  sleep 1
done
docker exec "$PG_CONTAINER" pg_isready -U hellenic -q 2>/dev/null || err "PostgreSQL failed to start"
log "PostgreSQL ready"

# --- Construct DATABASE_URL from POSTGRES_PASSWORD (ignore .env value to avoid mismatch) ---
export DATABASE_URL="postgresql://hellenic:${PG_PASSWORD}@localhost:5432/hellenic"

# --- Dependencies ---
log "Installing dependencies..."
pnpm install --silent

# --- Build shared (needed by other packages) ---
log "Building shared package..."
pnpm --filter @hellenic-bot/shared build

# --- Migrations ---
log "Generating migrations..."
pnpm --filter @hellenic-bot/api db:generate 2>/dev/null || true

log "Applying migrations..."
pnpm --filter @hellenic-bot/api db:migrate

# --- Start ---
log "Starting all services (API + Bot + Webapp)..."
echo ""
echo -e "  API:    ${GREEN}http://localhost:3000${NC}"
echo -e "  Webapp: ${GREEN}http://localhost:5173${NC}"
echo ""
if [ -z "${BOT_TOKEN:-}" ] || [ "$BOT_TOKEN" = "123456:ABC-DEF" ]; then
  warn "BOT_TOKEN not set — bot will fail to start. Edit .env and restart."
  warn "Webapp will work for UI debugging without the bot."
fi
echo ""

pnpm dev
