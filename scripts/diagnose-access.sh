#!/usr/bin/env bash
# Comprueba que el frontend es accesible por LAN (no solo localhost).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# shellcheck disable=SC1090
[[ -f .env ]] && set -a && source .env && set +a

PORT="${FRONTEND_SSL_PORT:-8080}"
LAN_IP="${LAN_IP:-$(hostname -I 2>/dev/null | awk '{print $1}')}"

red() { printf '\033[0;31m✗\033[0m %s\n' "$*"; }
grn() { printf '\033[0;32m✓\033[0m %s\n' "$*"; }
ylw() { printf '\033[1;33m!\033[0m %s\n' "$*"; }

echo "=== NILO frontend — diagnóstico de acceso ==="
echo "Puerto HTTPS: ${PORT}"
echo "IP LAN:       ${LAN_IP:-?(no detectada)}"
echo

if ss -tlnp 2>/dev/null | grep -q ":${PORT} "; then
  grn "Puerto ${PORT} en escucha:"
  ss -tlnp 2>/dev/null | grep ":${PORT} " || true
else
  red "Nada escucha en el puerto ${PORT}. ¿Contenedor levantado? (./deploy.sh)"
  exit 1
fi

echo
echo "--- localhost ---"
if curl -kf --max-time 5 "https://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
  grn "https://127.0.0.1:${PORT}/ responde"
else
  red "https://127.0.0.1:${PORT}/ NO responde (¿certificados en certs/?)"
fi

if [[ -n "${LAN_IP}" ]]; then
  echo
  echo "--- LAN (${LAN_IP}) ---"
  if curl -kf --max-time 5 "https://${LAN_IP}:${PORT}/" >/dev/null 2>&1; then
    grn "https://${LAN_IP}:${PORT}/ responde — equipo2/tablet deberían poder entrar"
  else
    red "https://${LAN_IP}:${PORT}/ NO responde (timeout o rechazo)"
    ylw "Causa habitual: firewall (ufw/iptables) bloquea el puerto ${PORT} desde la red."
    ylw "En el servidor prueba:"
    echo "  sudo ufw allow ${PORT}/tcp"
    echo "  sudo ufw reload"
    echo "  # o: sudo iptables -I INPUT -p tcp --dport ${PORT} -j ACCEPT"
    echo
    ylw "Desde equipo2/tablet NO uses http:// — solo:"
    echo "  https://${LAN_IP}:${PORT}/login"
  fi
fi

echo
HTML="$(curl -ks --max-time 5 "https://127.0.0.1:${PORT}/" 2>/dev/null || true)"
if echo "$HTML" | grep -q 'crossorigin'; then
  red "index.html aún tiene crossorigin — ejecuta ./deploy.sh --rebuild"
else
  grn "index.html sin crossorigin (JS debería cargar en el navegador)"
fi

JS="$(echo "$HTML" | grep -oE '/assets/index-[^"]+\.js' | head -1)"
if [[ -n "$JS" ]]; then
  if curl -kf --max-time 5 "https://127.0.0.1:${PORT}${JS}" >/dev/null 2>&1; then
    grn "Bundle JS responde: ${JS}"
  else
    red "Bundle JS no responde: ${JS}"
  fi
fi

echo
echo "=== fin ==="
