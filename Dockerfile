# ---------- Etapa 1: build ----------
FROM node:22-alpine AS build

WORKDIR /app

# Instala dependencias con cache eficiente
COPY package.json package-lock.json* ./
RUN npm ci

# Copia el código y genera el build de producción
COPY . .

# Variables Vite (se inyectan en el bundle en tiempo de build)
ARG VITE_API_BASE_URL=http://localhost:8001/api/v1
ARG VITE_APP_NAME=NILO
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_NAME=$VITE_APP_NAME

RUN npm run build

# ---------- Etapa 2: servir con nginx ----------
FROM nginx:1.27-alpine AS runtime

# Configuración de nginx con fallback para SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Artefactos estáticos generados por Vite
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
