#!/usr/bin/env bash
# Despliegue del frontend NILO con Docker Compose (HTTPS).
#
# Uso:
#   ./deploy.sh              # construye y arranca (requiere certs/)
#   ./deploy.sh --rebuild    # reconstruye la app (usa imágenes base locales si existen)
#   ./deploy.sh --stop       # para y elimina el contenedor
#   ./deploy.sh --logs       # muestra logs en tiempo real
#   ./deploy.sh --dev        # desarrollo local HTTPS (npm run dev + mkcert)
#   ./deploy.sh --mkcert     # genera certs/ (mkcert si existe, si no OpenSSL)
#   ./deploy.sh --openssl    # genera certs/ autofirmado con OpenSSL
#
# URLs de desarrollo:
#   Frontend: https://192.168.1.43:8080  (proxy /api/v1 → backend :8443)
#   API directa: https://192.168.1.43:8443/api/v1

set -euo pipefail
 
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

ENV_FILE=".env"
ENV_EXAMPLE=".env.example"
CERT_DIR="certs"
IMAGE_NAME="nilo-frontend:latest"

log() { printf '\033[1;34m→\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; }

# --- Barra de progreso del deploy ---
PROGRESS_TOTAL=0
PROGRESS_CURRENT=0
PROGRESS_LABEL=""
PROGRESS_BAR_WIDTH=32

progress_init() {
  PROGRESS_TOTAL="$1"
  PROGRESS_CURRENT=0
  PROGRESS_LABEL=""
}

progress_render() {
  local pct=0
  local filled=0
  local empty=0
  local bar_f bar_e

  if (( PROGRESS_TOTAL > 0 )); then
    pct=$((PROGRESS_CURRENT * 100 / PROGRESS_TOTAL))
    filled=$((pct * PROGRESS_BAR_WIDTH / 100))
  fi
  empty=$((PROGRESS_BAR_WIDTH - filled))
  bar_f=$(printf '%*s' "$filled" '' | tr ' ' '#')
  bar_e=$(printf '%*s' "$empty" '' | tr ' ' '-')
  printf '\r\033[36m[\033[0m%s%s\033[36m]\033[0m %3d%% %s' "$bar_f" "$bar_e" "$pct" "$PROGRESS_LABEL"
}

progress_step() {
  PROGRESS_LABEL="$1"
  PROGRESS_CURRENT=$((PROGRESS_CURRENT + 1))
  progress_render
  printf '\n'
}

progress_done() {
  PROGRESS_CURRENT=$PROGRESS_TOTAL
  PROGRESS_LABEL="Completado"
  progress_render
  printf '\n'
}

# Ejecuta un comando; en error muestra log y termina.
run_step() {
  local label=$1
  shift
  local log_file
  log_file="$(mktemp "${TMPDIR:-/tmp}/nilo-deploy.XXXXXX")"

  progress_step "$label"

  if "$@" >"$log_file" 2>&1; then
    rm -f "$log_file"
    return 0
  fi

  printf '\n'
  err "Falló: $label"
  err "--- Salida del comando ---"
  tail -n 60 "$log_file" >&2 || cat "$log_file" >&2
  rm -f "$log_file"
  exit 1
}

# Igual que run_step pero muestra la salida en vivo (build Docker, etc.).
run_step_live() {
  local label=$1
  shift
  local log_file exit_code

  log_file="$(mktemp "${TMPDIR:-/tmp}/nilo-deploy.XXXXXX")"
  progress_step "$label"

  set +o pipefail
  "$@" 2>&1 | tee "$log_file"
  exit_code="${PIPESTATUS[0]}"
  set -o pipefail

  if (( exit_code == 0 )); then
    rm -f "$log_file"
    return 0
  fi

  printf '\n'
  err "Falló: $label (código $exit_code)"
  err "--- Últimas líneas ---"
  tail -n 40 "$log_file" >&2 || true
  rm -f "$log_file"
  exit "$exit_code"
}

on_deploy_error() {
  local code=$1
  local line=$2
  if (( code == 0 )); then
    return 0
  fi
  printf '\n'
  err "Deploy abortado inesperadamente (código ${code}, línea ${line})."
  exit "$code"
}

DEPLOY_TMP_CFG=""

cleanup_deploy_tmp() {
  if [[ -n "$DEPLOY_TMP_CFG" ]]; then
    rm -rf "$DEPLOY_TMP_CFG"
    DEPLOY_TMP_CFG=""
  fi
}

trap 'on_deploy_error $? $LINENO' ERR

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

hint_docker_registry() {
  err "No se pudo contactar con Docker Hub (registry-1.docker.io) — timeout o red lenta."
  err ""
  if docker_base_images_present; then
    err "Las imágenes base ya están en este servidor. Vuelve a ejecutar:"
    err "  ./deploy.sh --rebuild"
    err ""
    err "El script usará la caché local automáticamente (no hace falta ninguna variable)."
  else
    err "Faltan node:22-alpine y/o nginx:1.27-alpine en local. Opciones:"
    err "  1. Cuando haya red: docker pull node:22-alpine && docker pull nginx:1.27-alpine"
    err "  2. Importar desde otra máquina:"
    err "     docker save node:22-alpine nginx:1.27-alpine | gzip > nilo-base-images.tar.gz"
    err "     gunzip -c nilo-base-images.tar.gz | docker load"
    err "  3. Luego: ./deploy.sh --rebuild"
  fi
  err ""
  err "Diagnóstico:"
  err "  curl -I --max-time 20 https://registry-1.docker.io/v2/"
  err "  docker image inspect node:22-alpine nginx:1.27-alpine"
}

DOCKER_BASE_IMAGES=(node:22-alpine nginx:1.27-alpine)

docker_base_images_present() {
  local img
  for img in "${DOCKER_BASE_IMAGES[@]}"; do
    if ! docker image inspect "$img" >/dev/null 2>&1; then
      return 1
    fi
  done
  return 0
}

log_is_registry_timeout() {
  local log_file=$1
  grep -qiE 'registry-1\.docker\.io|Timeout exceeded|awaiting headers|connection refused|i/o timeout|network is unreachable' "$log_file"
}

hint_docker_build_failure() {
  local log_file=$1
  if [[ -f "$log_file" ]] && log_is_registry_timeout "$log_file"; then
    hint_docker_registry
  else
    hint_docker_credentials
  fi
}

hint_mkcert() {
  err "Faltan certificados TLS en ${CERT_DIR}/cert.pem y ${CERT_DIR}/key.pem"
  err ""
  err "Generar certificados:"
  err "  LAN_IP=192.168.1.43 ./deploy.sh --mkcert     # mkcert o OpenSSL (fallback)"
  err "  LAN_IP=192.168.1.43 ./deploy.sh --openssl    # solo autofirmado OpenSSL"
  err ""
  err "Instalar mkcert (opcional, CA de confianza local):"
  err "  https://github.com/FiloSottile/mkcert#installation"
  err "  p. ej. en Linux: go install filippo.io/mkcert@latest"
  err ""
  err "O copia cert.pem/key.pem del repo backend (certs/)."
}

generate_tls_openssl() {
  require_cmd openssl
  local lan_ip="${1:-127.0.0.1}"

  mkdir -p "$ROOT_DIR/$CERT_DIR"
  log "Generando certificado autofirmado con OpenSSL (SAN: $lan_ip, localhost)…"
  openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
    -keyout "$ROOT_DIR/$CERT_DIR/key.pem" -out "$ROOT_DIR/$CERT_DIR/cert.pem" \
    -subj "/CN=NILO/O=NeoVisions" \
    -addext "subjectAltName=IP:${lan_ip},IP:127.0.0.1,DNS:localhost"
  chmod 600 "$ROOT_DIR/$CERT_DIR/key.pem"
  warn "Certificado autofirmado: en tablet hay que aceptar la advertencia del navegador."
  warn "Para evitar avisos instala mkcert y vuelve a ejecutar ./deploy.sh --mkcert"
}

generate_tls_mkcert() {
  require_cmd mkcert
  local lan_ip="${1:-127.0.0.1}"

  mkdir -p "$ROOT_DIR/$CERT_DIR"
  log "Generando certificados mkcert (SAN: $lan_ip, localhost, 127.0.0.1)…"
  mkcert -install 2>/dev/null || true
  mkcert -cert-file "$ROOT_DIR/$CERT_DIR/cert.pem" -key-file "$ROOT_DIR/$CERT_DIR/key.pem" \
    "$lan_ip" localhost 127.0.0.1
  chmod 600 "$ROOT_DIR/$CERT_DIR/key.pem"
  log "Certificados en ${CERT_DIR}/. Tablet: instala CA con mkcert -CAROOT → rootCA.pem"
}

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
    else
      err "Falta $ENV_FILE y no existe $ENV_EXAMPLE."
      exit 1
    fi
  fi
  # shellcheck disable=SC1090
  set -a && source "$ENV_FILE" && set +a
}

ensure_tls_certs() {
  local cert="$ROOT_DIR/$CERT_DIR/cert.pem"
  local key="$ROOT_DIR/$CERT_DIR/key.pem"

  if [[ -f "$cert" && -f "$key" ]]; then
    log "Certificados TLS encontrados en ${CERT_DIR}/."
    return 0
  fi

  hint_mkcert
  exit 1
}

cmd_mkcert() {
  ensure_env

  local lan_ip="${LAN_IP:-$(hostname -I 2>/dev/null | awk '{print $1}')}"
  if [[ -z "$lan_ip" ]]; then
    lan_ip="127.0.0.1"
    warn "No se detectó IP LAN; se usará solo localhost."
  fi

  if command -v mkcert >/dev/null 2>&1; then
    generate_tls_mkcert "$lan_ip"
  else
    warn "mkcert no instalado; usando OpenSSL (certificado autofirmado)."
    generate_tls_openssl "$lan_ip"
  fi
}

cmd_openssl() {
  ensure_env
  local lan_ip="${LAN_IP:-$(hostname -I 2>/dev/null | awk '{print $1}')}"
  [[ -z "$lan_ip" ]] && lan_ip="127.0.0.1"
  generate_tls_openssl "$lan_ip"
}

docker_build_image() {
  local no_cache=false
  if [[ "${1:-}" == "--no-cache" ]]; then
    no_cache=true
  fi

  local api_url="${VITE_API_BASE_URL:-https://192.168.1.43:8443/api/v1}"
  local api_direct="${VITE_API_DIRECT:-false}"
  local app_name="${VITE_APP_NAME:-NILO}"
  local use_pull=false
  local pull_hint=""
  local max_attempts="${DOCKER_BUILD_RETRIES:-3}"
  local attempt=1
  local log_file exit_code label

  if [[ "${SKIP_DOCKER_PULL:-}" == "1" ]]; then
    warn "SKIP_DOCKER_PULL=1 — build sin descargar imágenes base."
  elif [[ "${FORCE_DOCKER_PULL:-}" == "1" ]]; then
    use_pull=true
    log "FORCE_DOCKER_PULL=1 — se intentará actualizar node:22-alpine y nginx:1.27-alpine."
  elif docker_base_images_present; then
    log "Imágenes base en caché local; build sin contactar Docker Hub."
  else
    use_pull=true
    warn "Faltan imágenes base locales; se descargarán desde Docker Hub."
  fi

  if $use_pull; then
    pull_hint=" (descarga node:22-alpine + nginx:1.27-alpine)"
  fi

  label="Construyendo imagen ${IMAGE_NAME}${pull_hint}"
  progress_step "$label"

  while (( attempt <= max_attempts )); do
    local -a build_args=(
      --progress=plain
      --build-arg "VITE_API_BASE_URL=${api_url}"
      --build-arg "VITE_API_DIRECT=${api_direct}"
      --build-arg "VITE_APP_NAME=${app_name}"
      -t "$IMAGE_NAME"
      .
    )

    if $use_pull; then
      build_args=(--progress=plain --pull "${build_args[@]:1}")
    fi

    if $no_cache; then
      build_args=(--no-cache "${build_args[@]}")
    fi

    log_file="$(mktemp "${TMPDIR:-/tmp}/nilo-deploy.XXXXXX")"

    if (( attempt > 1 )); then
      warn "Reintento ${attempt}/${max_attempts}…"
    fi

    set +o pipefail
    docker build "${build_args[@]}" 2>&1 | tee "$log_file"
    exit_code="${PIPESTATUS[0]}"
    set -o pipefail

    if (( exit_code == 0 )); then
      rm -f "$log_file"
      return 0
    fi

    if [[ -f "$log_file" ]] && log_is_registry_timeout "$log_file"; then
      if $use_pull && docker_base_images_present; then
        warn "Docker Hub no responde; continuando con imágenes locales (sin --pull)…"
        use_pull=false
        pull_hint=""
        rm -f "$log_file"
        continue
      fi
    fi

    if (( attempt < max_attempts )); then
      warn "Build falló (código ${exit_code}); nuevo intento en 8 s…"
      rm -f "$log_file"
      attempt=$((attempt + 1))
      sleep 8
      continue
    fi

    printf '\n'
    err "Falló: $label (código $exit_code)"
    err "--- Últimas líneas ---"
    tail -n 40 "$log_file" >&2 || true
    hint_docker_build_failure "$log_file"
    rm -f "$log_file"
    exit "$exit_code"
  done
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
  ensure_tls_certs

  if [[ ! -d node_modules ]]; then
    log "Instalando dependencias…"
    npm ci
  fi

  local lan_ip="${LAN_IP:-$(hostname -I 2>/dev/null | awk '{print $1}')}"
  local dev_port="${VITE_DEV_PORT:-5173}"
  log "Servidor Vite HTTPS en https://${lan_ip:-localhost}:$dev_port"
  log "API proxied: /api/v1 → ${VITE_API_BASE_URL:-https://192.168.1.43:8443/api/v1}"
  npm run dev
}

cmd_deploy() {
  local rebuild=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --rebuild) rebuild=true ;;
      *) err "Opción desconocida en deploy: $1"; exit 1 ;;
    esac
    shift
  done

  require_cmd docker
  progress_init 6

  run_step "Comprobando configuración (.env)" ensure_env
  run_step "Comprobando certificados TLS" ensure_tls_certs

  local ssl_port="${FRONTEND_SSL_PORT:-8080}"
  local lan_ip="${LAN_IP:-$(hostname -I 2>/dev/null | awk '{print $1}')}"

  log "Abrir SOLO con HTTPS: https://${lan_ip:-localhost}:${ssl_port}/login"
  warn "NO uses http://…:${ssl_port} — se quedará colgado (puerto TLS)."
  log "API proxy: ${BACKEND_PROXY_HOST:-192.168.1.43}:${BACKEND_PORT:-8443} (SNI ${BACKEND_SSL_NAME:-192.168.1.43})"

  progress_step "Preparando configuración Docker"
  DEPLOY_TMP_CFG="$(prepare_docker_config)"
  trap cleanup_deploy_tmp RETURN
  trap 'cleanup_deploy_tmp; on_deploy_error $? $LINENO' ERR

  export DOCKER_CONFIG="$DEPLOY_TMP_CFG"
  export DOCKER_BUILDKIT=0
  export COMPOSE_DOCKER_CLI_BUILD=0

  if $rebuild; then
    docker_build_image --no-cache
  else
    docker_build_image
  fi

  run_step "Arrancando contenedor" docker compose up -d --no-build

  progress_step "Comprobando servicios"
  sleep 2
  local checks_ok=0
  if curl -kf --max-time 8 "https://127.0.0.1:${ssl_port}/" >/dev/null 2>&1; then
    log "OK: frontend responde en :${ssl_port}"
    checks_ok=$((checks_ok + 1))
  else
    warn "El frontend no responde en https://127.0.0.1:${ssl_port} — revisa: docker logs nilo-frontend"
  fi
  if curl -kf --max-time 8 "https://127.0.0.1:${ssl_port}/api/v1/auth/cors-probe" >/dev/null 2>&1; then
    log "OK: proxy API /api/v1 responde"
    checks_ok=$((checks_ok + 1))
  else
    warn "Proxy API falla (504/timeout). Prueba en .env: VITE_API_DIRECT=true y ./deploy.sh --rebuild"
    warn "O comprueba: curl -k https://${BACKEND_PROXY_HOST:-192.168.1.43}:${BACKEND_PORT:-8443}/health"
  fi

  if [[ -n "${lan_ip:-}" ]]; then
    if curl -kf --max-time 8 "https://${lan_ip}:${ssl_port}/" >/dev/null 2>&1; then
      log "OK: accesible por LAN https://${lan_ip}:${ssl_port}"
    else
      warn "NO responde en https://${lan_ip}:${ssl_port} — suele ser FIREWALL (ufw/iptables)."
      warn "  sudo ufw allow ${ssl_port}/tcp && sudo ufw reload"
      warn "  Diagnóstico: ./scripts/diagnose-access.sh"
    fi
  fi

  progress_done
  log "URL: https://${lan_ip:-localhost}:${ssl_port}/login  (solo https://, nunca http://)"
  docker compose ps

  if (( checks_ok == 0 )); then
    warn "Deploy terminado pero ninguna comprobación HTTP pasó. Revisa logs: docker logs nilo-frontend"
    exit 1
  fi
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
    --mkcert)
      cmd_mkcert
      ;;
    --openssl)
      cmd_openssl
      ;;
    --diagnose)
      bash "$ROOT_DIR/scripts/diagnose-access.sh"
      ;;
    --rebuild|-r)
      shift
      cmd_deploy --rebuild "$@"
      ;;
    --help|-h)
      sed -n '2,15p' "$0"
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
