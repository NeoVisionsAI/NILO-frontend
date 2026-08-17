#!/usr/bin/env bash
# Despliegue del frontend NILO con Docker Compose (HTTPS).
#
# Uso:
#   ./deploy.sh              # construye y arranca (requiere certs/)
#   ./deploy.sh --rebuild    # fuerza reconstrucción sin caché
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
  local -a build_args=(
    --build-arg "VITE_API_BASE_URL=${api_url}"
    --build-arg "VITE_API_DIRECT=${api_direct}"
    --build-arg "VITE_APP_NAME=${app_name}"
    -t "$IMAGE_NAME"
    .
  )

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
  ensure_env
  ensure_tls_certs

  local ssl_port="${FRONTEND_SSL_PORT:-8080}"
  local lan_ip="${LAN_IP:-$(hostname -I 2>/dev/null | awk '{print $1}')}"
  local tmp_cfg

  log "Abrir SOLO con HTTPS: https://${lan_ip:-localhost}:${ssl_port}/login"
  warn "NO uses http://…:${ssl_port} — se quedará colgado (puerto TLS)."
  log "API proxy: ${BACKEND_PROXY_HOST:-192.168.1.43}:${BACKEND_PORT:-8443} (SNI ${BACKEND_SSL_NAME:-192.168.1.43})"

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

  sleep 2
  if curl -kf --max-time 8 "https://127.0.0.1:${ssl_port}/" >/dev/null 2>&1; then
    log "OK: frontend responde en :${ssl_port}"
  else
    warn "El frontend no responde en https://127.0.0.1:${ssl_port} — revisa: docker logs nilo-frontend"
  fi
  if curl -kf --max-time 8 "https://127.0.0.1:${ssl_port}/api/v1/auth/cors-probe" >/dev/null 2>&1; then
    log "OK: proxy API /api/v1 responde"
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

  log "URL: https://${lan_ip:-localhost}:${ssl_port}/login  (solo https://, nunca http://)"
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
