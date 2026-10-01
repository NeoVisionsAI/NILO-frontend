#!/usr/bin/env bash
#
# VM sin código fuente: pull GHCR + contenedor frontend (nginx + estáticos).
#
#   ./deploy.sh                  # pull + up -d (manual)
#   sudo ./deploy.sh --install-systemd   # arranque automático al boot (+ pull)
#   sudo ./deploy.sh --uninstall-systemd
#
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRED="${CREDENTIALS_FILE:-$DIR/credentials.env}"
UNIT_NAME="nilo-frontend-vm.service"
UNIT_DEST="/etc/systemd/system/${UNIT_NAME}"
export FRONTEND_IMAGE="${FRONTEND_IMAGE:-ghcr.io/neovisionsai/nilo-frontend:latest}"

require_compose() {
  if ! docker compose version >/dev/null 2>&1; then
    echo "Se necesita 'docker compose'." >&2
    exit 1
  fi
}

require_credentials() {
  if [[ ! -f "$CRED" ]]; then
    echo "Falta $CRED — cp credentials.env.example credentials.env" >&2
    exit 1
  fi
}

require_certs() {
  # shellcheck disable=SC1090
  set -a && source "$CRED" && set +a
  local cert_dir="${CERTS_DIR:-./certs}"
  if [[ "$cert_dir" != /* ]]; then
    cert_dir="$DIR/$cert_dir"
  fi
  if [[ ! -f "$cert_dir/cert.pem" || ! -f "$cert_dir/key.pem" ]]; then
    echo "Faltan cert.pem y key.pem en ${cert_dir}." >&2
    echo "Genera con mkcert en el repo dev o copia desde el host. Ver certs/README.md en GitHub." >&2
    exit 1
  fi
}

compose() {
  docker compose --env-file "$CRED" "$@"
}

cmd_deploy() {
  require_compose
  require_credentials
  require_certs
  cd "$DIR"
  echo "==> Pull ${FRONTEND_IMAGE}"
  compose pull frontend
  echo "==> Up (detached)"
  compose up -d
  local port="${FRONTEND_SSL_PORT:-8080}"
  echo "==> Listo. Abrir: https://<IP>:${port}/login"
  echo "    Health: curl -s http://127.0.0.1/healthz"
}

cmd_foreground() {
  require_compose
  require_credentials
  require_certs
  cd "$DIR"
  echo "==> Pull ${FRONTEND_IMAGE}"
  compose pull frontend || true
  exec docker compose --env-file "$CRED" up --remove-orphans
}

resolve_docker_compose() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
  else
    echo "No hay docker compose." >&2
    exit 1
  fi
}

cmd_install_systemd() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "Ejecuta: sudo $0 --install-systemd" >&2
    exit 1
  fi
  require_credentials
  local service_user="${SUDO_USER:-root}"
  if [[ "$service_user" == "root" ]]; then
    service_user="${NILO_SERVICE_USER:-root}"
  fi
  if ! groups "$service_user" 2>/dev/null | grep -q '\bdocker\b'; then
    echo "AVISO: $service_user no está en el grupo docker." >&2
  fi
  chmod +x "$DIR/deploy.sh"
  local dc
  dc="$(resolve_docker_compose)"
  local tmp
  tmp="$(mktemp)"
  sed \
    -e "s|@INSTALL_DIR@|${DIR}|g" \
    -e "s|@SERVICE_USER@|${service_user}|g" \
    -e "s|@DOCKER_COMPOSE@|${dc}|g" \
    "$DIR/nilo-frontend-vm.service" >"$tmp"
  install -m 0644 "$tmp" "$UNIT_DEST"
  rm -f "$tmp"
  systemctl daemon-reload
  systemctl enable "$UNIT_NAME"
  systemctl restart "$UNIT_NAME" || systemctl start "$UNIT_NAME"
  echo "Instalado: $UNIT_NAME (usuario $service_user)"
  echo "  systemctl status $UNIT_NAME"
  echo "  journalctl -u $UNIT_NAME -f"
}

cmd_uninstall_systemd() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "Ejecuta: sudo $0 --uninstall-systemd" >&2
    exit 1
  fi
  systemctl stop "$UNIT_NAME" 2>/dev/null || true
  systemctl disable "$UNIT_NAME" 2>/dev/null || true
  rm -f "$UNIT_DEST"
  systemctl daemon-reload
  echo "Desinstalado: $UNIT_NAME"
}

case "${1:-}" in
  --foreground)
    cmd_foreground
    ;;
  --install-systemd)
    cmd_install_systemd
    ;;
  --uninstall-systemd)
    cmd_uninstall_systemd
    ;;
  *)
    cmd_deploy
    ;;
esac
