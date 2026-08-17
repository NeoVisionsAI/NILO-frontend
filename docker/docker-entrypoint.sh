#!/bin/sh
set -e

if [ ! -f /etc/nginx/ssl/cert.pem ] || [ ! -f /etc/nginx/ssl/key.pem ]; then
  echo "ERROR: faltan cert.pem y key.pem en certs/. Ver certs/README.md" >&2
  exit 1
fi

BACKEND_HOST="${BACKEND_HOST:-host.docker.internal}"
BACKEND_PORT="${BACKEND_PORT:-8443}"

sed \
  -e "s/__BACKEND_HOST__/${BACKEND_HOST}/g" \
  -e "s/__BACKEND_PORT__/${BACKEND_PORT}/g" \
  /etc/nginx/snippets/spa-locations.conf.template \
  > /etc/nginx/snippets/spa-locations.conf

echo "nginx proxy: /api/v1 → https://${BACKEND_HOST}:${BACKEND_PORT}/api/v1/"

exec nginx -g 'daemon off;'
