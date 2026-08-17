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
IMAGE_NAME="nilo-frontend:latest"

log() { printf '\033[1;34m→\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "No se encontró el comando '$1'."
    exit 1
  fi
}

hint_docker_credentials() {
  err "Fallo al construir o descargar imágenes base (node/nginx)."
  err ""
  err "Arreglo permanente en tu usuario (recomendado):"
  err "  cp ~/.docker/config.json ~/.docker/config.json.bak 2>/dev/null || true"
  err "  sed -i '/\"credsStore\"/d; /\"credHelpers\"/d' ~/.docker/config.json"
  err ""
  err "Comprueba: docker pull node:22-alpine"
}

# Config Docker temporal sin credsStore/credHelpers (evita fallos GPG en build).
prepare_docker_config() {
  local tmp cfg_src
  tmp="$(mktemp -d)"
  cfg_src="${HOME}/.docker/config.json"

  if [[ -f "$cfg_src" ]] && command -v python3 >/dev/null 2>&1; then
    SANITIZED_DOCKER_CONFIG="$tmp" python3 - <<'PY'
import json, os
src = os.path.expanduser("~/.docker/config.json")
dst = os.path.join(os.environ["SANITIZED_DOCKER_CONFIG"], "config.json")
with open(src, encoding="utf-8") as f:
    cfg = json.load(f)
cfg.pop("credsStore", None)
cfg.pop("credHelpers", None)
with open(dst, "w", encoding="utf-8") as f:
    json.dump(cfg, f)
PY
  else
    echo '{}' > "${tmp}/config.json"
  fi

  printf '%s' "$tmp"
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

docker_build_image() {
  local no_cache=false
  if [[ "${1:-}" == "--no-cache" ]]; then
    no_cache=true
  fi

  local api_url="${VITE_API_BASE_URL:-http://localhost:8001/api/v1}"
  local app_name="${VITE_APP_NAME:-NILO}"
  local -a build_args=(--build-arg "VITE_API_BASE_URL=${api_url}" --build-arg "VITE_APP_NAME=${app_name}" -t "$IMAGE_NAME" .)

  if $no_cache; then
    build_args=(--no-cache "${build_args[@]}")
  fi

  log "Descargando imágenes base (node:22-alpine, nginx:1.27-alpine)…"
  docker pull node:22-alpine
  docker pull nginx:1.27-alpine

  log "Construyendo imagen ${IMAGE_NAME}…"
  docker build "${build_args[@]}"
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
  local tmp_cfg

  log "API (build): $api_url"
  log "Puerto frontend: $port"

  tmp_cfg="$(prepare_docker_config)"
  # shellcheck disable=SC2064
  trap "rm -rf '${tmp_cfg}'" RETURN

  export DOCKER_CONFIG="$tmp_cfg"
  export DOCKER_BUILDKIT=0
  export COMPOSE_DOCKER_CLI_BUILD=0

  if $rebuild; then
    if ! docker_build_image --no-cache; then
      hint_docker_credentials
      exit 1
    fi
  elif ! docker_build_image; then
    hint_docker_credentials
    exit 1
  fi

  log "Arrancando contenedor…"
  docker compose up -d --no-build

  log "Frontend disponible en http://localhost:$port"
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
    --help-credentials)
      hint_docker_credentials
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
