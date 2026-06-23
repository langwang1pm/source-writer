#!/bin/bash
# ============================================================
# source-writer  Production Deployment Script
# Usage:  ./quick_deploy.sh
# Config: .env (copy from .env.example)
# Target: PGX server (x86/ARM auto-adapt)
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo "============================================"
echo "  source-writer  Production Deployment"
echo "  Architecture: $(uname -m)"
echo "  Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""

log_info "Step 1/8: Checking dependencies..."

if command -v docker &> /dev/null; then
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
        log_info "  Docker Compose (v2 plugin)"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
        log_info "  Docker Compose (standalone)"
    else
        log_error "Docker installed but no compose command"
        exit 1
    fi
else
        log_error "Docker not installed"
    exit 1
fi

if ! command -v git &> /dev/null; then
    log_error "git not installed"
    exit 1
fi
log_info "  git OK"
log_info "All dependencies OK"

log_info "Step 2/8: Checking config..."

if [ ! -f ".env" ]; then
    log_error ".env not found!"
    echo ""
    echo "  cp .env.example .env"
    echo "  vi .env"
    echo ""
    exit 1
fi
log_info ".env OK"

export $(grep -v '^#' .env | grep -E '^[A-Z_]+=' | xargs 2>/dev/null || true)

log_info "Step 3/8: Checking project structure..."

for f in backend/requirements.txt backend/Dockerfile frontend/package.json frontend/Dockerfile frontend/nginx.conf; do
    if [ ! -f "$f" ]; then
        log_error "$f not found"
        exit 1
    fi
    log_info "  $f  OK"
done
log_info "Structure OK"

log_info "Step 4/8: Ensuring upload directory..."

UPLOAD_DIR="/data/source-writer/uploads"
if [ ! -d "$UPLOAD_DIR" ]; then
    log_info "  Creating $UPLOAD_DIR ..."
    if [ "$(id -u)" -eq 0 ]; then
        mkdir -p "$UPLOAD_DIR"
    elif command -v sudo &> /dev/null; then
        sudo mkdir -p "$UPLOAD_DIR"
    else
        log_warn "  Cannot create $UPLOAD_DIR, run: sudo mkdir -p $UPLOAD_DIR"
    fi
    if [ -d "$UPLOAD_DIR" ]; then
        log_info "  Created $UPLOAD_DIR"
    fi
else
    log_info "  $UPLOAD_DIR exists"
fi

log_info "Step 5/8: Cleaning old deployment..."

$COMPOSE_CMD down --remove-orphans 2>/dev/null || true
log_info "  Old containers cleaned"

log_info "Step 6/8: Pre-pulling base images..."

docker pull python:3.12-slim       || log_warn "  pull python failed"
docker pull node:22-alpine         || log_warn "  pull node failed"
docker pull nginx:alpine           || log_warn "  pull nginx failed"
docker pull onlyoffice/documentserver:latest || log_warn "  pull onlyoffice failed"

log_info "Step 7/8: Building and starting..."

log_info "  Building images (ARM/x86)..."
$COMPOSE_CMD build --no-cache

log_info "  Starting services..."
$COMPOSE_CMD up -d

log_info "Step 8/8: Health check (max 90s)..."

FRONTEND_OK=false
BACKEND_OK=false

for i in $(seq 1 18); do
    sleep 5

    if [ "$FRONTEND_OK" = false ]; then
        if curl -sf http://localhost/ > /dev/null 2>&1; then
            FRONTEND_OK=true
            log_info "  Frontend READY"
        fi
    fi

    if [ "$BACKEND_OK" = false ]; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/enterprises 2>/dev/null || echo "000")
        if [ "$HTTP_CODE" != "000" ] && [ "$HTTP_CODE" != "502" ] && [ "$HTTP_CODE" != "504" ]; then
            BACKEND_OK=true
            log_info "  Backend READY"
        fi
    fi

    if [ "$FRONTEND_OK" = true ] && [ "$BACKEND_OK" = true ]; then
        break
    fi

    echo -n "."
done

echo ""


echo ""
echo "============================================"
echo "  Service Status"
echo "============================================"
$COMPOSE_CMD ps

echo ""
if [ "$FRONTEND_OK" = true ] && [ "$BACKEND_OK" = true ]; then
    log_info "Deployment SUCCESS!"
elif [ "$FRONTEND_OK" = true ]; then
    log_warn "Frontend OK, but backend has issues. Check logs."
    echo "  $COMPOSE_CMD logs backend"
else
    log_warn "Some services may not be ready. Check logs."
    echo "  $COMPOSE_CMD logs -f"
fi

echo ""
echo "Access URLs:"
echo "  Frontend: http://localhost"
echo "  Backend:  http://localhost/api/ (via nginx reverse proxy)"
echo ""
echo "Useful commands:"
echo "  Logs:  $COMPOSE_CMD logs -f"
echo "  Restart:  $COMPOSE_CMD restart"
echo "  Stop:  $COMPOSE_CMD down"
echo "  Update:  git pull && $COMPOSE_CMD build && $COMPOSE_CMD up -d"
echo ""
echo "Check backend health from inside container:"
echo "  $COMPOSE_CMD exec backend curl -sf http://localhost:8002/health"
echo ""
