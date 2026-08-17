#!/bin/sh
set -e

if [ ! -f /etc/nginx/ssl/cert.pem ] || [ ! -f /etc/nginx/ssl/key.pem ]; then
  echo "ERROR: faltan cert.pem y key.pem en certs/ (mkcert). Ver certs/README.md" >&2
  exit 1
fi

exec nginx -g 'daemon off;'
