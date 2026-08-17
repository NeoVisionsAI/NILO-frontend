#!/bin/sh
set -e

if [ ! -f /etc/nginx/ssl/cert.pem ] || [ ! -f /etc/nginx/ssl/key.pem ]; then
  echo "ERROR: faltan cert.pem y key.pem en certs/. Ver certs/README.md" >&2
  exit 1
fi

# Desde el contenedor NO usar la IP LAN del host (hairpin); usar host.docker.internal.
BACKEND_PROXY_HOST="${BACKEND_PROXY_HOST:-host.docker.internal}"
BACKEND_SSL_NAME="${BACKEND_SSL_NAME:-192.168.1.43}"
BACKEND_PORT="${BACKEND_PORT:-8443}"

sed \
  -e "s/__BACKEND_PROXY_HOST__/${BACKEND_PROXY_HOST}/g" \
  -e "s/__BACKEND_SSL_NAME__/${BACKEND_SSL_NAME}/g" \
  -e "s/__BACKEND_PORT__/${BACKEND_PORT}/g" \
  /etc/nginx/snippets/spa-locations.conf.template \
  > /etc/nginx/snippets/spa-locations.conf

echo "nginx proxy: /api/v1 → https://${BACKEND_PROXY_HOST}:${BACKEND_PORT}/api/v1/ (SNI: ${BACKEND_SSL_NAME})"

exec nginx -g 'daemon off;'
