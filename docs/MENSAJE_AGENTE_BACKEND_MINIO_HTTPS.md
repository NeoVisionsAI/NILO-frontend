# Mensaje backend — MinIO presignadas en HTTPS (Mixed Content)

Copia al agente **NILO-backend** / operaciones.

---

## Síntoma

Frontend en **https://nilomed.eu**. Al enviar landmarks/audio/vídeo, la API devuelve `upload_url` tipo:

```text
http://192.168.122.1:9000/nilo-data/patients/...?X-Amz-...
```

El navegador muestra **Mixed Content** y **bloquea el PUT**. La UI se queda en «Subiendo…».  
Los **datos fisiológicos** funcionan (solo Mongo, sin MinIO).

## Causa

Las URLs presignadas salen de `MINIO_PUBLIC_ENDPOINT` / `MINIO_PUBLIC_HOST` con **`MINIO_SECURE=false`** y host **interno** no accesible ni HTTPS desde el usuario.

Código: `app/storage/minio_client.py` → `get_presign_minio()` usa `settings.MINIO_PUBLIC_ENDPOINT`.

## Qué hacer (operaciones)

1. **Exponer MinIO al cliente por HTTPS** (recomendado):
   - Nginx/Caddy en `https://minio.nilomed.eu` (o subpath) → proxy al MinIO interno.
   - O publicar el puerto API MinIO con TLS en el host público.

2. **Variables del contenedor API** (ej. `credentials.env` / compose):

   ```env
   MINIO_PUBLIC_HOST=minio.nilomed.eu
   MINIO_API_PORT=443
   MINIO_SECURE=true
   ```

   O explícito:

   ```env
   MINIO_PUBLIC_ENDPOINT=minio.nilomed.eu:443
   ```

   (`derive_infra_connection_settings` en `app/core/config.py` — revisar que `Minio(..., secure=True)` se use al firmar URLs.)

3. **CORS en MinIO** para origen `https://nilomed.eu` (PUT desde el navegador).

4. **Comprobar** tras cambio:

   ```bash
   # Tras POST /landmarks, la upload_url debe empezar por https:// y ser alcanzable
   curl -I "https://minio.nilomed.eu/..."
   ```

## Alternativa (más trabajo en backend)

Proxy de subida en API: `PUT /api/v1/landmarks/{id}/upload` con body, sin presignada al navegador. No es el diseño actual (nilo-node usa presignadas).

## Documentación

Actualizar `docs/02.nilo_node_ingestion_spec.md` con el caso **navegador HTTPS** (clínico en nilomed.eu), no solo nilo-node en LAN.

---

**Fin del mensaje.**