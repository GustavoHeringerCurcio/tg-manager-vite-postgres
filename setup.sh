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

read -r -p "  Porta interna app  (padrão 3000): " APP_PORT
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

echo "  ✓ Generating secure passwords..."

ADMIN_PASSWORD=$(openssl rand -hex 16)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# ── 5. Check Docker ────────────────────────────────────────────────

if ! command -v docker &>/dev/null; then
  echo "  ✓ Installing Docker..."
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker.io docker-compose-v2
  sudo systemctl enable --now docker
fi

# ── 6. Create .env ─────────────────────────────────────────────────

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

ENCRYPTION_KEY=${ENCRYPTION_KEY}

LIVEPIX_CLIENT_ID=${LIVEPIX_CLIENT_ID}
LIVEPIX_CLIENT_SECRET=${LIVEPIX_CLIENT_SECRET}

MAX_PIX_GENERATIONS=5
INTERACTION_RETENTION_DAYS=90
LOG_PAYLOADS=false
EOF

# ── 7. Start containers ────────────────────────────────────────────

echo "  ✓ Building and starting containers..."
sudo docker compose up -d --build

# ── 8. Done ────────────────────────────────────────────────────────

echo ""
echo "  ╔════════════════════════════════════╗"
echo "  ║          Deploy concluído          ║"
echo "  ╠════════════════════════════════════╣"
echo "  ║                                    ║"
printf "  ║  Dashboard:  https://%-15s║\n" "${DOMAIN}"
printf "  ║  Senha:      %-21s║\n" "${ADMIN_PASSWORD}"
echo "  ║                                    ║"
echo "  ║  Guarde a senha. Ela não será     ║"
echo "  ║  exibida novamente.               ║"
echo "  ╚════════════════════════════════════╝"
echo ""
