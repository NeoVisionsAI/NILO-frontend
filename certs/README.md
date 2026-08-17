# Certificados TLS (desarrollo)

El frontend se sirve en **HTTPS** (`https://192.168.1.43:8080`). La cámara y otras APIs del navegador requieren contexto seguro.

## Generar con mkcert (recomendado)

En el host de desarrollo:

```bash
mkcert -install
LAN_IP=192.168.1.43 ./deploy.sh --mkcert
```

Esto crea `cert.pem` y `key.pem` en esta carpeta.

## Tablet / móvil

Para evitar el aviso de certificado autofirmado, instala la CA de mkcert en el dispositivo:

1. En el PC: `mkcert -CAROOT` → copia `rootCA.pem` al tablet.
2. Android: instala como certificado de CA (Ajustes → Seguridad).
3. iOS: instala el perfil y actívalo en Ajustes → General → Información → Confianza.

Alternativa: aceptar manualmente el certificado la primera vez que abras `https://192.168.1.43:8080`.

## Compartir con el backend

Puedes reutilizar los mismos archivos `cert.pem` / `key.pem` del repo backend si incluyen SAN para la IP y puertos usados.
