#!/bin/sh
set -e

if [ ! -f /etc/nginx/ssl/cert.pem ] || [ ! -f /etc/nginx/ssl/key.pem ]; then
  echo "ERROR: faltan cert.pem y key.pem en certs/. Ver certs/README.md" >&2
  exit 1
fi

# Una sola URL: https://<IP>:8080  (NO usar http:// en el puerto 8080)
FRONTEND_SSL_PORT="${FRONTEND_SSL_PORT:-8080}"
BACKEND_PROXY_HOST="${BACKEND_PROXY_HOST:-127.0.0.1}"
BACKEND_SSL_NAME="${BACKEND_SSL_NAME:-192.168.1.43}"
BACKEND_PORT="${BACKEND_PORT:-8443}"

subst_snippets() {
  sed \
    -e "s/__BACKEND_PROXY_HOST__/${BACKEND_PROXY_HOST}/g" \
    -e "s/__BACKEND_SSL_NAME__/${BACKEND_SSL_NAME}/g" \
    -e "s/__BACKEND_PORT__/${BACKEND_PORT}/g" \
    < /etc/nginx/snippets/spa-locations.conf.template \
    > /etc/nginx/snippets/spa-locations.conf
}

cat > /etc/nginx/conf.d/default.conf <<EOF
# Puerto 80 → HTTPS :8080
server {
    listen 80;
    server_name _;

    location = /healthz {
        access_log off;
        return 200 'ok';
        add_header Content-Type text/plain;
    }

    location / {
        return 301 https://\$host:${FRONTEND_SSL_PORT}\$request_uri;
    }
}

# App HTTPS (cámara, login, etc.)
server {
    listen ${FRONTEND_SSL_PORT} ssl;
    listen [::]:${FRONTEND_SSL_PORT} ssl;
    server_name _;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml image/svg+xml;
    gzip_min_length 1024;

    include /etc/nginx/snippets/spa-locations.conf;
}
EOF

subst_snippets

echo "Abrir: https://<IP>:${FRONTEND_SSL_PORT}  (no http://:${FRONTEND_SSL_PORT})"
echo "nginx proxy: /api/v1 → https://${BACKEND_PROXY_HOST}:${BACKEND_PORT}/api/v1/ (SNI: ${BACKEND_SSL_NAME})"

exec nginx -g 'daemon off;'
