#!/bin/bash
set -e

VPS="vps"
APP_DIR="/opt/hellenic-bot"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEBAPP_PORT=8443

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

# --- 1. Sync files ---
log "Syncing files to VPS..."
rsync -az --delete \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.turbo' \
  --exclude '*.tsbuildinfo' \
  "$LOCAL_DIR/" "$VPS:$APP_DIR/"

# --- 2. Ensure .env exists on VPS ---
ssh "$VPS" "test -f $APP_DIR/.env" 2>/dev/null || {
  warn ".env not found on VPS, creating from local..."
  scp "$LOCAL_DIR/.env" "$VPS:$APP_DIR/.env"
}
ssh "$VPS" "grep -q WEBAPP_PORT $APP_DIR/.env || echo 'WEBAPP_PORT=$WEBAPP_PORT' >> $APP_DIR/.env"

# --- 3. Build and start containers ---
log "Building and starting containers..."
ssh "$VPS" "cd $APP_DIR && sudo docker compose up -d --build" 2>&1 | tail -5

log "Waiting for services..."
sleep 5
ssh "$VPS" "cd $APP_DIR && sudo docker compose ps --format 'table {{.Name}}\t{{.Status}}'"
echo ""

# --- 4. Start tunnel and update bot ---
log "Starting cloudflared tunnel..."

ssh -t "$VPS" "
  pkill -f 'cloudflared tunnel --url http://localhost:$WEBAPP_PORT' 2>/dev/null || true
  sleep 1

  LOGFILE=\$(mktemp)
  cloudflared tunnel --url http://localhost:$WEBAPP_PORT > \$LOGFILE 2>&1 &
  PID=\$!

  URL=''
  for i in \$(seq 1 30); do
    URL=\$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' \$LOGFILE 2>/dev/null | head -1)
    if [ -n \"\$URL\" ]; then break; fi
    sleep 1
  done

  if [ -z \"\$URL\" ]; then
    echo 'Failed to get tunnel URL:'
    cat \$LOGFILE
    kill \$PID 2>/dev/null
    rm \$LOGFILE
    exit 1
  fi

  rm \$LOGFILE

  echo ''
  echo '=== Tunnel URL:' \$URL '==='
  echo ''

  sed -i \"s|WEBAPP_URL=.*|WEBAPP_URL=\$URL|\" $APP_DIR/.env
  cd $APP_DIR && sudo docker compose up -d bot 2>&1 | tail -1

  echo 'Bot recreated with WEBAPP_URL='\$URL
  echo ''
  echo 'Send /start to your bot in Telegram.'
  echo 'Press Ctrl+C to stop tunnel.'
  echo ''

  wait \$PID
"
