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

5. **Start cloudflared tunnel** (kill existing first):
   ```
   ssh vps "pkill -f 'cloudflared tunnel' 2>/dev/null || true"
   ssh vps "nohup cloudflared tunnel --url http://localhost:8443 > /tmp/cf.log 2>&1 & sleep 5; grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf.log | head -1"
   ```
   Capture the tunnel URL from output.

6. **Update WEBAPP_URL and restart bot** with the tunnel URL:
   ```
   ssh vps "sed -i 's|WEBAPP_URL=.*|WEBAPP_URL=<TUNNEL_URL>|' /opt/hellenic-bot/.env && cd /opt/hellenic-bot && sudo docker compose up -d bot"
   ```

7. **Report** the tunnel URL and tell the user to send /start to the bot.

## Important

- Migrations run automatically on API container startup (`pnpm db:migrate` in Dockerfile CMD).
- The tunnel URL changes on every restart — the bot must be recreated each time.
- Do NOT use `ssh -t` — it requires a TTY and fails in non-interactive mode.
