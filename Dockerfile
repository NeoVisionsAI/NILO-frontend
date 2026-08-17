# ---------- Etapa 1: build ----------
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=https://192.168.1.43:8443/api/v1
ARG VITE_APP_NAME=NILO
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_NAME=$VITE_APP_NAME

RUN npm run build

# ---------- Etapa 2: servir con nginx (HTTPS) ----------
FROM nginx:1.27-alpine AS runtime

COPY nginx/snippets/spa-locations.conf.template /etc/nginx/snippets/spa-locations.conf.template
COPY docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O- http://localhost/healthz | grep -q ok || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
