# Hellenic Bot — Deployment & Infrastructure

## Local Development

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- PostgreSQL 16 (local install or Docker)

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env
# Edit .env with your values (see Environment Variables below)

# Start PostgreSQL (if using Docker for DB only)
docker run -d --name hellenic-pg \
  -e POSTGRES_DB=hellenic \
  -e POSTGRES_USER=hellenic \
  -e POSTGRES_PASSWORD=hellenic \
  -p 5432:5432 \
  postgres:16-alpine

# Run database migrations
pnpm --filter api db:migrate

# Start all services in dev mode
pnpm dev
```

`pnpm dev` runs Turborepo which starts all packages in parallel:
- `bot` — Telegram bot (watches for changes)
- `api` — Hono HTTP server (watches for changes)
- `webapp` — Vite dev server with HMR

### Telegram Bot Development

For local development, you need a publicly accessible URL for the Mini App. Options:
- Use [ngrok](https://ngrok.com/) or similar tunnel to expose the local Vite dev server
- Set `WEBAPP_URL` in `.env` to the tunnel URL

## Production — Ubuntu VPS + Docker Compose

Everything runs via a single `docker compose up -d`. Autostart is handled by Docker's restart policy + systemd.

### Prerequisites (VPS)

```bash
# Install Docker + Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Re-login for group to take effect
```

### Deploy

```bash
# Clone repo
git clone <repo-url> /opt/hellenic-bot
cd /opt/hellenic-bot

# Create env file
cp .env.example .env
nano .env  # fill in real values

# Start everything
docker compose up -d
```

One command to start, one to stop:
```bash
docker compose up -d      # start all services
docker compose down        # stop all services
docker compose logs -f     # tail all logs
docker compose logs -f bot # tail bot logs only
```

### Architecture

```
Internet
   │
   ├── Telegram API ←→ bot (polling) ──→ api:3000 (internal)
   │
   └── :80 ──→ nginx (webapp)
                       ├── /              → static files (React SPA)
                       ├── /api/internal/ → 403 (blocked)
                       └── /api/*         → api:3000 (reverse proxy, strips /api prefix)
                                            └── postgres:5432
```

- `webapp` — nginx container, exposed on port 80. TLS termination happens upstream (Caddy or certbot — see HTTPS section). Serves the React SPA and reverse-proxies `/api` to the `api` service (stripping the `/api` prefix — so `/api/learn/stats` arrives at Hono as `/learn/stats`)
- nginx blocks `/api/internal/` from external access — internal endpoints are only reachable within the Docker network (bot → api directly)
- `api` — Hono HTTP server. Internal only, not exposed to the internet. Owns the database connection
- `bot` — grammY, connects to Telegram via long polling (no inbound port). Calls `api` directly at `http://api:3000/internal/users/upsert` (no `/api` prefix, no nginx involved)
- `postgres` — internal only, no exposed port

### docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: hellenic
      POSTGRES_USER: hellenic
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hellenic"]
      interval: 5s
      timeout: 3s
      retries: 5

  api:
    build:
      context: .
      dockerfile: packages/api/Dockerfile
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://hellenic:${POSTGRES_PASSWORD}@postgres:5432/hellenic
      BOT_TOKEN: ${BOT_TOKEN}
      PORT: 3000
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/health > /dev/null 2>&1 || exit 1"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - internal

  bot:
    build:
      context: .
      dockerfile: packages/bot/Dockerfile
    restart: unless-stopped
    environment:
      BOT_TOKEN: ${BOT_TOKEN}
      API_URL: http://api:3000
      WEBAPP_URL: ${WEBAPP_URL}
      NODE_ENV: production
    depends_on:
      api:
        condition: service_healthy
    networks:
      - internal

  webapp:
    build:
      context: .
      dockerfile: packages/webapp/Dockerfile
      args:
        VITE_API_URL: /api
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      api:
        condition: service_healthy
    networks:
      - internal

volumes:
  postgres_data:

networks:
  internal:
```

### nginx Configuration

The `webapp` container runs nginx with the following key rules (configured in `packages/webapp/nginx.conf`):

```nginx
server {
    listen 80;

    # Static files (React SPA)
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # Block internal API routes from external access
    location /api/internal/ {
        return 403;
    }

    # Reverse proxy to API (strip /api prefix)
    location /api/ {
        proxy_pass http://api:3000/;
    }
}
```

**How it works:** For prefix locations, nginx uses **longest match** — `/api/internal/` (more specific) wins over `/api/` regardless of order in the config. The trailing slash ensures only paths under `/api/internal/` are blocked (not hypothetical paths like `/api/internalother`). The bot calls internal endpoints directly via `http://api:3000/internal/users/upsert` (within the Docker network, bypassing nginx).

### Autostart

Docker daemon is enabled by default after installation (`systemctl enable docker`). Combined with `restart: unless-stopped` on every service, all containers start automatically after VPS reboot.

Verify:
```bash
# Check Docker starts on boot
sudo systemctl is-enabled docker
# Should output: enabled

# Simulate reboot check
docker compose ps  # all services should show "Up"
```

If Docker is not enabled:
```bash
sudo systemctl enable docker
```

### HTTPS

The Mini App requires HTTPS (Telegram requirement). Options:

**Option A: Reverse proxy on host (recommended)**

Use Caddy on the host — it handles TLS certificates automatically:

```bash
# Install Caddy
sudo apt install -y caddy

# /etc/caddy/Caddyfile
yourdomain.com {
    reverse_proxy localhost:80
}

sudo systemctl enable caddy
sudo systemctl restart caddy
```

Change `webapp` port mapping to `127.0.0.1:80:80` so nginx is only accessible through Caddy:
```yaml
  webapp:
    ports:
      - "127.0.0.1:80:80"
```

**Option B: Certbot + nginx**

Mount TLS certificates into the `webapp` container and configure nginx for HTTPS directly. More manual setup — requires periodic renewal via cron.

### Updating

```bash
cd /opt/hellenic-bot
git pull
docker compose up -d --build
```

`--build` rebuilds images only when source code has changed (Docker layer caching keeps it fast).

## Environment Variables

| Variable            | Service  | Required   | Default       | Description                            |
|---------------------|----------|------------|---------------|----------------------------------------|
| `BOT_TOKEN`         | bot, api | yes        | —             | Telegram Bot API token from @BotFather (also used by API for JWT signing) |
| `POSTGRES_PASSWORD` | postgres | yes        | —             | PostgreSQL password                    |
| `WEBAPP_URL`        | bot      | yes        | —             | Public URL of the Mini App (https)     |
| `API_URL`           | bot      | auto       | —             | Internal API URL. Auto-set to `http://api:3000` in docker-compose; set to `http://localhost:3000` for local dev. |
| `DATABASE_URL`      | api      | auto       | —             | PostgreSQL connection string. Auto-constructed in docker-compose from `POSTGRES_PASSWORD`. Set manually for local dev. |
| `VITE_API_URL`      | webapp   | no         | `/api`        | API base path for the frontend Hono RPC client (build-time arg) |
| `PORT`              | api      | no         | `3000`        | HTTP server port                       |
| `NODE_ENV`          | all      | no         | `development` | `development` or `production`          |

Both `DATABASE_URL` and `API_URL` are constructed inside `docker-compose.yml` — no need to set them manually in production. For local development (without Docker for app services), set both explicitly in `.env`.

`VITE_API_URL` is set as a build arg in `docker-compose.yml` (`/api`). For local development, configure a Vite proxy so `/api` requests are forwarded to the local API server — this avoids cross-origin issues and keeps `VITE_API_URL` = `/api` in all environments:

```ts
// packages/webapp/vite.config.ts — dev server only
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
}
```

### Example `.env`

```env
BOT_TOKEN=123456:ABC-DEF
POSTGRES_PASSWORD=strong-random-password-here
DATABASE_URL=postgresql://hellenic:hellenic@localhost:5432/hellenic  # local dev only
API_URL=http://localhost:3000                                       # local dev only
WEBAPP_URL=https://yourdomain.com
# NODE_ENV=production    # local dev only; docker-compose sets this automatically in production
```

## Database Migrations

Managed by Drizzle ORM.

```bash
# Local development
pnpm --filter api db:generate   # generate migration from schema changes
pnpm --filter api db:migrate    # apply pending migrations
pnpm --filter api db:studio     # open Drizzle Studio (DB browser)
```

In production, migrations run automatically on `api` container startup — the entrypoint runs `pnpm db:migrate` before starting the server.
