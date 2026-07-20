#!/usr/bin/env bash
set -euo pipefail

# ── Botflix VPS Setup ──────────────────────────────────────────────
# Run this on a fresh Ubuntu VPS after cloning the repo.
#   chmod +x setup.sh && ./setup.sh
# ────────────────────────────────────────────────────────────────────

echo ""
echo "  ╔════════════════════════════════════╗"
echo "  ║       Botflix VPS Setup           ║"
echo "  ╚════════════════════════════════════╝"
echo ""

# ── 1. Domain ──────────────────────────────────────────────────────

read -r -p "  Domain (ex: acaideangra.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
  echo "  ✗ Domain is required."
  exit 1
fi

echo ""

# ── 2. App port ────────────────────────────────────────────────────

read -r -p "  App port (default 3000): " APP_PORT
APP_PORT=${APP_PORT:-3000}

echo ""

# ── 3. Livepix credentials ─────────────────────────────────────────

read -r -p "  Livepix Client ID: " LIVEPIX_CLIENT_ID
if [ -z "$LIVEPIX_CLIENT_ID" ]; then
  echo "  ✗ Livepix Client ID is required."
  exit 1
fi

read -r -p "  Livepix Client Secret: " LIVEPIX_CLIENT_SECRET
if [ -z "$LIVEPIX_CLIENT_SECRET" ]; then
  echo "  ✗ Livepix Client Secret is required."
  exit 1
fi

echo ""

# ── 4. Generate secrets ────────────────────────────────────────────

echo "  ✓ Configuring default credentials..."

ADMIN_PASSWORD="admin-botflix"
POSTGRES_PASSWORD="botflix-pass"

# ── 5. Check Docker ────────────────────────────────────────────────

if ! command -v docker &>/dev/null; then
  echo "  ✓ Installing Docker..."
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker.io docker-compose-v2
  sudo systemctl enable --now docker
fi

# ── 6. Create .env ─────────────────────────────────────────────────

OVERWRITE="y"
if [ -f .env ]; then
  echo "  ⚠  .env already exists!"
  read -r -p "  Overwrite? Admin password and keys will be lost (y/N): " OVERWRITE
  OVERWRITE=${OVERWRITE:-n}
fi

if [ "${OVERWRITE,,}" = "y" ]; then
  echo "  ✓ Creating .env..."

cat > .env <<EOF
NODE_ENV=production
APP_PORT=${APP_PORT}
DOMAIN=${DOMAIN}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

POSTGRES_USER=botflix
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=botflix
DATABASE_URL=postgresql://botflix:${POSTGRES_PASSWORD}@db:5432/botflix?schema=public

LIVEPIX_CLIENT_ID=${LIVEPIX_CLIENT_ID}
LIVEPIX_CLIENT_SECRET=${LIVEPIX_CLIENT_SECRET}

MAX_PIX_GENERATIONS=5
INTERACTION_RETENTION_DAYS=90
LOG_PAYLOADS=false
PAYMENT_POLL_WINDOW_MINUTES=30
EOF
else
  echo "  ✓ Keeping existing .env."
fi

echo ""

# ── 7. EasyPanel / Traefik (auto-detect) ──────────────────────────

DOCKER_COMPOSE_CMD="sudo docker compose up -d --build"
if sudo docker network ls --format '{{.Name}}' 2>/dev/null | grep -qx 'easypanel'; then
  echo "  ✓ EasyPanel/Traefik detected — using automatic HTTPS."
  DOCKER_COMPOSE_CMD="sudo docker compose -f docker-compose.yml -f docker-compose.easypanel.yml up -d --build"
  USE_EASYPANEL="y"
else
  USE_EASYPANEL="n"
fi

echo ""

# ── 8. Start containers ────────────────────────────────────────────

echo "  ✓ Building and starting containers..."
eval "$DOCKER_COMPOSE_CMD"

# ── 9. Done ────────────────────────────────────────────────────────

echo ""
echo "  ╔════════════════════════════════════╗"
echo "  ║         Deploy complete           ║"
echo "  ╠════════════════════════════════════╣"
echo "  ║                                    ║"
if [ "${USE_EASYPANEL,,}" = "y" ]; then
  printf "  ║  Dashboard:  https://%-15s║\n" "${DOMAIN}"
elif [ "${APP_PORT}" = "80" ]; then
  printf "  ║  Dashboard:  http://%-16s║\n" "${DOMAIN}"
else
  printf "  ║  Dashboard:  http://%s:%-11s║\n" "${DOMAIN}" "${APP_PORT}"
fi
if [ "${OVERWRITE,,}" = "y" ]; then
  printf "  ║  Password:   %-21s║\n" "${ADMIN_PASSWORD}"
  echo "  ║                                    ║"
  echo "  ║  Save the password. It will not   ║"
  echo "  ║  be displayed again.              ║"
else
  echo "  ║  Password:   (check .env)         ║"
fi
echo "  ╚════════════════════════════════════╝"
echo ""
