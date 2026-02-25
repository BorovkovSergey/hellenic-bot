Deploy the project to VPS.

## Context

- VPS SSH alias: `vps`
- App directory on VPS: `/opt/hellenic-bot`
- Webapp port: `8443`
- Deploy script: `scripts/deploy.sh`
- Tunnel: cloudflared (trycloudflare.com, temporary URLs)

## Steps

1. **Sync files** to VPS via rsync (exclude node_modules, dist, .git, .env, .turbo, *.tsbuildinfo):
   ```
   rsync -az --delete --exclude 'node_modules' --exclude 'dist' --exclude '.git' --exclude '.env' --exclude '.turbo' --exclude '*.tsbuildinfo' ./ vps:/opt/hellenic-bot/
   ```

2. **Build and start containers** on VPS:
   ```
   ssh vps "cd /opt/hellenic-bot && sudo docker compose up -d --build"
   ```

3. **Wait 5 seconds**, then check container status:
   ```
   ssh vps "cd /opt/hellenic-bot && sudo docker compose ps --format 'table {{.Name}}\t{{.Status}}'"
   ```
   All services must be Up/Healthy. If any service is unhealthy, check logs with `ssh vps "cd /opt/hellenic-bot && sudo docker compose logs <service> --tail 30"` and fix before proceeding.

4. **Check API health**:
   ```
   ssh vps "curl -s http://localhost:8443/api/health"
   ```
   Must return `{"status":"ok"}`.

5. **Check tunnel** — only start if not already running:
   ```
   ssh vps "pgrep -f 'cloudflared tunnel' > /dev/null && echo 'RUNNING' || echo 'NOT_RUNNING'"
   ```
   - If `RUNNING` — skip to step 6, tunnel is fine (it proxies localhost:8443, doesn't care about container restarts).
   - If `NOT_RUNNING` — start a new tunnel:
     ```
     ssh vps "nohup cloudflared tunnel --url http://localhost:8443 > /tmp/cf.log 2>&1 & sleep 5; grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf.log | head -1"
     ```
     Capture the tunnel URL, then update WEBAPP_URL and restart bot:
     ```
     ssh vps "sed -i 's|WEBAPP_URL=.*|WEBAPP_URL=<TUNNEL_URL>|' /opt/hellenic-bot/.env && cd /opt/hellenic-bot && sudo docker compose up -d bot"
     ```

6. **Report** deployment result. If tunnel was already running, just confirm containers are up.

## Important

- Migrations run automatically on API container startup (`pnpm db:migrate` in Dockerfile CMD).
- Do NOT restart the tunnel on every deploy — it survives container rebuilds. Only restart if it's not running.
- The tunnel URL changes on every tunnel restart — the bot must be recreated only when the URL changes.
- Do NOT use `ssh -t` — it requires a TTY and fails in non-interactive mode.
