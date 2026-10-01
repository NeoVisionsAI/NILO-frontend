#!/usr/bin/env bash
# Descarga solo los ficheros de despliegue (sin clonar el repo ni bajar app/).
# Uso:
#   mkdir -p ~/nilo-frontend && cd ~/nilo-frontend
#   curl -fsSL https://raw.githubusercontent.com/NeoVisionsAI/NILO-frontend/main/deploy/vm-ghcr/bootstrap.sh | bash
#
# Repo privado:
#   GITHUB_TOKEN=ghp_... curl -fsSL -H "Authorization: Bearer $GITHUB_TOKEN" \
#     https://raw.githubusercontent.com/NeoVisionsAI/NILO-frontend/main/deploy/vm-ghcr/bootstrap.sh | bash
#
# Actualizar solo scripts de despliegue (NO la imagen Docker):
#   ./bootstrap.sh
# Actualizar imagen tras push de código:
#   ./deploy.sh
set -euo pipefail

REPO="${NILO_BOOTSTRAP_REPO:-NeoVisionsAI/NILO-frontend}"
BRANCH="${NILO_BOOTSTRAP_BRANCH:-main}"
BASE="https://raw.githubusercontent.com/${REPO}/${BRANCH}/deploy/vm-ghcr"
DIR="${NILO_DEPLOY_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]:-.}")" 2>/dev/null && pwd || echo "$PWD")}"

if [[ ! -f "$DIR/bootstrap.sh" && -z "${BASH_SOURCE:-}" ]]; then
  DIR="$PWD"
fi

FILES=(compose.yaml deploy.sh run.sh credentials.env.example nilo-frontend-vm.service README.md bootstrap.sh)

curl_fetch() {
  local url="$1" out="$2"
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    curl -fsSL -H "Authorization: Bearer ${GITHUB_TOKEN}" "$url" -o "$out"
  else
    curl -fsSL "$url" -o "$out"
  fi
}

mkdir -p "$DIR"
cd "$DIR"
echo "==> Descargando deploy/vm-ghcr desde ${REPO}@${BRANCH} → $DIR"
for f in "${FILES[@]}"; do
  curl_fetch "${BASE}/${f}" "$f"
done
chmod +x deploy.sh run.sh bootstrap.sh 2>/dev/null || true
if [[ ! -f credentials.env ]]; then
  cp credentials.env.example credentials.env
  echo "==> Creado credentials.env — edítalo y prepara certs/ antes de ./deploy.sh"
else
  echo "==> credentials.env ya existe (no sobrescrito)"
fi
echo "==> Listo. Siguiente: certs/, editar credentials.env, docker login ghcr.io, ./deploy.sh"
