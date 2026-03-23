#!/usr/bin/env bash
# ==========================================================
# Clave Seguridad — Local Development Bootstrap
# ==========================================================
# Usage: bash scripts/bootstrap.sh
# Sets up everything needed for local development.

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
check_prereqs() {
  info "Checking prerequisites..."

  if ! command -v node &> /dev/null; then
    error "Node.js is required (>=20). Install from https://nodejs.org"
    exit 1
  fi

  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -lt 20 ]; then
    error "Node.js 20+ required, found $(node -v)"
    exit 1
  fi
  info "Node.js $(node -v) OK"

  if ! command -v pnpm &> /dev/null; then
    warn "pnpm not found. Installing..."
    npm install -g pnpm@9
  fi
  info "pnpm $(pnpm --version) OK"

  if ! command -v docker &> /dev/null; then
    warn "Docker not found. You'll need it for PostgreSQL, Redis, and MediaMTX."
  else
    info "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') OK"
  fi
}

# Setup environment files
setup_env() {
  info "Setting up environment files..."

  # Frontend .env
  if [ ! -f .env ]; then
    if [ -f .env.example ]; then
      cp .env.example .env
      info "Created .env from .env.example"
    else
      warn "No .env.example found, skipping frontend env"
    fi
  else
    info ".env already exists, skipping"
  fi

  # Docker .env
  if [ ! -f .env.docker ]; then
    if [ -f .env.docker.example ]; then
      cp .env.docker.example .env.docker
      # Generate random secrets
      JWT_SECRET=$(openssl rand -base64 48 | head -c 48 2>/dev/null || echo "change-me-$(date +%s)-minimum-32-chars-required")
      CRED_KEY=$(openssl rand -base64 48 | head -c 48 2>/dev/null || echo "change-me-$(date +%s)-minimum-32-chars-required")
      DB_PASS=$(openssl rand -base64 24 | head -c 24 2>/dev/null || echo "dev-password-$(date +%s)")

      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/CHANGE_ME_GENERATE_WITH_openssl_rand_base64_48/$JWT_SECRET/" .env.docker
        sed -i '' "s/CHANGE_ME_STRONG_PASSWORD_HERE/$DB_PASS/" .env.docker
      else
        sed -i "s/CHANGE_ME_GENERATE_WITH_openssl_rand_base64_48/$JWT_SECRET/" .env.docker
        sed -i "s/CHANGE_ME_STRONG_PASSWORD_HERE/$DB_PASS/" .env.docker
      fi
      info "Created .env.docker with generated secrets"
    fi
  else
    info ".env.docker already exists, skipping"
  fi

  # Backend .env
  if [ ! -f backend/.env ]; then
    if [ -f backend/.env.example ]; then
      cp backend/.env.example backend/.env
      info "Created backend/.env from backend/.env.example"
    fi
  else
    info "backend/.env already exists, skipping"
  fi
}

# Install dependencies
install_deps() {
  info "Installing frontend dependencies..."
  npm install

  info "Installing backend dependencies..."
  cd backend
  pnpm install
  cd ..
}

# Start infrastructure
start_infra() {
  if command -v docker &> /dev/null; then
    info "Starting infrastructure (PostgreSQL, Redis, MediaMTX)..."
    docker compose --env-file .env.docker up -d clave-postgres clave-redis clave-mediamtx 2>/dev/null || \
    docker-compose --env-file .env.docker up -d clave-postgres clave-redis clave-mediamtx 2>/dev/null || \
    warn "Could not start Docker services. Start them manually."

    info "Waiting for PostgreSQL to be ready..."
    for i in $(seq 1 30); do
      if docker exec clave-postgres pg_isready -U clave 2>/dev/null; then
        info "PostgreSQL is ready"
        break
      fi
      sleep 1
    done
  else
    warn "Docker not available. Start PostgreSQL, Redis, and MediaMTX manually."
  fi
}

# Summary
print_summary() {
  echo ""
  echo "=========================================="
  echo " Clave Seguridad — Setup Complete"
  echo "=========================================="
  echo ""
  echo " Start frontend:  npm run dev"
  echo " Start backend:   cd backend && pnpm dev"
  echo " Start all (Docker): docker compose --env-file .env.docker up -d"
  echo ""
  echo " Frontend: http://localhost:8080"
  echo " Backend:  http://localhost:3000"
  echo " API Docs: http://localhost:3000/docs"
  echo " Health:   http://localhost:3000/health"
  echo ""
  echo " Run tests:"
  echo "   Frontend: npm test"
  echo "   Backend:  cd backend && pnpm test"
  echo ""
}

# Main
main() {
  info "Bootstrapping Clave Seguridad..."
  check_prereqs
  setup_env
  install_deps
  start_infra
  print_summary
}

main "$@"
