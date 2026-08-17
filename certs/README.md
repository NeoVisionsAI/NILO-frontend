# Certificados TLS (desarrollo)

El frontend se sirve en **HTTPS** (`https://192.168.1.43:8080`).

## Generar certificados

```bash
LAN_IP=192.168.1.43 ./deploy.sh --mkcert
```

- Si tienes **mkcert** instalado → CA de confianza local (sin avisos en PC).
- Si **no** tienes mkcert → usa **OpenSSL** automáticamente (autofirmado; en tablet acepta la advertencia del navegador).

Solo OpenSSL explícito:

```bash
LAN_IP=192.168.1.43 ./deploy.sh --openssl
```

## Instalar mkcert (opcional)

Ver https://github.com/FiloSottile/mkcert#installation

En Linux (con Go):

```bash
go install filippo.io/mkcert@latest
mkcert -install
```

## Tablet / móvil

**Con mkcert:** copia `rootCA.pem` (`mkcert -CAROOT`) al tablet e instálalo como CA.

**Con OpenSSL:** abre `https://192.168.1.43:8080` y acepta el certificado la primera vez.

## Compartir con el backend

Puedes copiar `cert.pem` / `key.pem` del repo backend si incluyen la misma IP en SAN.
