#!/usr/bin/env bash
# Despliegue del frontend NILO con Docker Compose.
#
# Uso:
#   ./deploy.sh              # construye y arranca el contenedor
#   ./deploy.sh --rebuild    # fuerza reconstrucción sin caché
#   ./deploy.sh --stop       # para y elimina el contenedor
#   ./deploy.sh --logs       # muestra logs en tiempo real
#   ./deploy.sh --dev        # desarrollo local (npm run dev, sin Docker)
#
# URL del backend: edita VITE_API_BASE_URL en .env antes de desplegar.
# Tras cambiar la URL hay que reconstruir: ./deploy.sh --rebuild

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

log() { printf '\033[1;34m→\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "No se encontró el comando '$1'."
    exit 1
  fi
}

ensure_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    if [[ -f "$ENV_EXAMPLE" ]]; then
      cp "$ENV_EXAMPLE" "$ENV_FILE"
      warn "Se creó $ENV_FILE desde $ENV_EXAMPLE."
      warn "Revisa VITE_API_BASE_URL antes de desplegar en producción."
    else
      err "Falta $ENV_FILE y no existe $ENV_EXAMPLE."
      exit 1
    fi
  fi
  # shellcheck disable=SC1090
  set -a && source "$ENV_FILE" && set +a
}

cmd_stop() {
  require_cmd docker
  log "Deteniendo contenedor…"
  docker compose down
  log "Contenedor detenido."
}

cmd_logs() {
  require_cmd docker
  docker compose logs -f frontend
}

cmd_dev() {
  require_cmd npm
  ensure_env
  if [[ ! -d node_modules ]]; then
    log "Instalando dependencias…"
    npm ci
  fi
  log "Arrancando servidor de desarrollo en http://localhost:5173"
  log "API configurada en: ${VITE_API_BASE_URL:-http://localhost:8001/api/v1}"
  npm run dev
}

cmd_deploy() {
  local rebuild=false
  if [[ "${1:-}" == "--rebuild" ]]; then
    rebuild=true
  fi

  require_cmd docker
  ensure_env

  local port="${FRONTEND_PORT:-8080}"
  local api_url="${VITE_API_BASE_URL:-http://localhost:8001/api/v1}"

  log "API (build): $api_url"
  log "Puerto frontend: $port"

  if $rebuild; then
    log "Construyendo imagen sin caché…"
    docker compose build --no-cache
  else
    log "Construyendo imagen…"
    docker compose build
  fi

  log "Arrancando contenedor…"
  docker compose up -d

  log "Frontend disponible en http://localhost:$port"
  log "Estado: docker compose ps"
  docker compose ps
}

main() {
  case "${1:-}" in
    --stop|-s)
      cmd_stop
      ;;
    --logs|-l)
      cmd_logs
      ;;
    --dev|-d)
      cmd_dev
      ;;
    --rebuild|-r)
      cmd_deploy --rebuild
      ;;
    --help|-h)
      sed -n '2,12p' "$0"
      ;;
    "")
      cmd_deploy
      ;;
    *)
      err "Opción desconocida: $1 (usa --help)"
      exit 1
      ;;
  esac
}

main "$@"
