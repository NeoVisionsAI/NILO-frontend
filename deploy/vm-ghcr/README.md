# Despliegue VM sin código fuente (frontend)

Solo **Docker**, estos ficheros, **`credentials.env`** y **`certs/`** (TLS). No hace falta `git clone`.

| Fichero | Uso |
|---------|-----|
| `compose.yaml` | Imagen GHCR + red host + certs |
| `credentials.env` | Proxy backend, puerto HTTPS (crear desde `.example`) |
| `certs/` | `cert.pem` + `key.pem` (mkcert o copia) |
| `deploy.sh` | Pull + arranque; systemd al boot |

La app va **dentro de la imagen** `ghcr.io/neovisionsai/nilo-frontend`.

> **`deploy.sh` corre en la VM (host), no dentro del contenedor.** El contenedor ejecuta nginx con los estáticos compilados. Al boot, systemd lanza `deploy.sh --foreground`, que hace `pull` y `docker compose up`.

## Primera vez

```bash
cp credentials.env.example credentials.env
# Editar: BACKEND_PROXY_HOST, BACKEND_PORT, FRONTEND_SSL_PORT…

mkdir -p certs
# cert.pem + key.pem (ver certs/README.md en el repo)

docker login ghcr.io   # paquete privado

chmod +x deploy.sh
./deploy.sh
sudo ./deploy.sh --install-systemd
```

Abrir **https://&lt;IP&gt;:8080/login** (usa `https://`, no `http://` en el puerto TLS).

## Actualizar versión (solo código frontend)

```bash
./deploy.sh
# o:
sudo systemctl restart nilo-frontend-vm
```

Equivalente manual:

```bash
docker pull ghcr.io/neovisionsai/nilo-frontend:latest
```

## Obtener el bundle sin clonar el repo

**Instalación (una línea, repo público):**

```bash
mkdir -p ~/nilo-frontend && cd ~/nilo-frontend
curl -fsSL https://raw.githubusercontent.com/NeoVisionsAI/NILO-frontend/main/deploy/vm-ghcr/bootstrap.sh | bash
```

Repo privado: exporta `GITHUB_TOKEN` (scope `read`) antes del `curl`, o copia la carpeta por SCP.

## Qué actualizar y cuándo

| Cambio en GitHub | En la VM |
|------------------|----------|
| **Código del frontend** (commit + push → Actions) | Solo `./deploy.sh`. **No** bootstrap ni git. |
| **Scripts de despliegue** (`deploy.sh`, `compose.yaml`, …) | `./bootstrap.sh` |

- **Actions → artefacto `nilo-frontend-vm-ghcr-deploy`**: alternativa offline al bootstrap.

Documentación: [`docs/07.ghcr_deploy.md`](../../docs/07.ghcr_deploy.md).

## Integración con NILO-backend

- El frontend proxy `/api/v1` hacia el backend (`BACKEND_*` en `credentials.env`).
- En el **backend**, `CORS_ORIGINS` debe incluir el origen del frontend, p. ej. `https://192.168.1.43:8080`.
- Si el API está en HTTP `:8001` sin TLS, ajusta build de imagen (`VITE_API_DIRECT`) o proxy según tu stack.
