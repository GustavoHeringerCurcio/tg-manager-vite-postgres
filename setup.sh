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

# ── 2. Ports ────────────────────────────────────────────────────────

read -r -p "  Porta HTTP Caddy   (padrão 80):  " CADDY_HTTP_PORT
CADDY_HTTP_PORT=${CADDY_HTTP_PORT:-80}

read -r -p "  Porta HTTPS Caddy  (padrão 443): " CADDY_HTTPS_PORT
CADDY_HTTPS_PORT=${CADDY_HTTPS_PORT:-443}

read -r -p "  Porta interna app  (padrão 3000): " APP_PORT
APP_PORT=${APP_PORT:-3000}

echo ""

if [ "$CADDY_HTTPS_PORT" != "443" ]; then
  echo "  ⚠  Atenção: porta HTTPS não é 443."
  echo "     Telegram NÃO conseguirá enviar webhooks nesta porta."
  echo "     Escolha 443 se quiser que os bots funcionem."
  echo ""
  read -r -p "  Continuar mesmo assim? (s/N): " CONFIRM
  if [ "${CONFIRM,,}" != "s" ]; then
    echo "  ✗ Cancelado."
    exit 1
  fi
  echo ""
fi

# ── 3. Generate secrets ────────────────────────────────────────────

echo "  ✓ Generating secure passwords..."

ADMIN_PASSWORD=$(openssl rand -hex 16)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# ── 4. Check Docker ────────────────────────────────────────────────

if ! command -v docker &>/dev/null; then
  echo "  ✓ Installing Docker..."
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker.io docker-compose-v2
  sudo systemctl enable --now docker
fi

# ── 5. Create .env ─────────────────────────────────────────────────

echo "  ✓ Creating .env..."

cat > .env <<EOF
NODE_ENV=production
APP_PORT=${APP_PORT}
DOMAIN=${DOMAIN}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

CADDY_HTTP_PORT=${CADDY_HTTP_PORT}
CADDY_HTTPS_PORT=${CADDY_HTTPS_PORT}

POSTGRES_USER=botflix
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=botflix
DATABASE_URL=postgresql://botflix:${POSTGRES_PASSWORD}@db:5432/botflix?schema=public

ENCRYPTION_KEY=${ENCRYPTION_KEY}

LIVEPIX_CLIENT_ID=change-me
LIVEPIX_CLIENT_SECRET=change-me

MAX_PIX_GENERATIONS=5
INTERACTION_RETENTION_DAYS=90
LOG_PAYLOADS=false
EOF

# ── 6. Update Caddyfile with domain and port ───────────────────────

if [ -f Caddyfile ]; then
  sed -i "s/acaideangra\.com/${DOMAIN}/g" Caddyfile
  sed -i "s/app:3000/app:${APP_PORT}/g" Caddyfile
  echo "  ✓ Caddyfile updated: ${DOMAIN} -> app:${APP_PORT}"
fi

# ── 7. Start containers ────────────────────────────────────────────

echo "  ✓ Building and starting containers..."
sudo docker compose up -d --build

# ── 8. Done ────────────────────────────────────────────────────────

DASHBOARD_URL="https://${DOMAIN}"
if [ "$CADDY_HTTPS_PORT" != "443" ]; then
  DASHBOARD_URL="https://${DOMAIN}:${CADDY_HTTPS_PORT}"
fi

echo ""
echo "  ╔════════════════════════════════════╗"
echo "  ║          Deploy concluído          ║"
echo "  ╠════════════════════════════════════╣"
echo "  ║                                    ║"
printf "  ║  Dashboard:  %-21s║\n" "${DASHBOARD_URL}"
printf "  ║  Senha:      %-21s║\n" "${ADMIN_PASSWORD}"
echo "  ║                                    ║"
echo "  ║  Guarde a senha. Ela não será     ║"
echo "  ║  exibida novamente.               ║"
echo "  ╚════════════════════════════════════╝"
echo ""
