# Mensaje backend — `POST /landmarks/upload` 413 Request Entity Too Large

Copia al agente **NILO-backend** / operaciones (nginx + API).

---

## Síntoma

Desde el panel DEV del frontend (captura **real** MediaPipe face, HTTPS `nilomed.eu`):

```http
POST https://nilomed.eu/api/v1/landmarks/upload
→ 413 Request Entity Too Large
```

Audio y landmarks **sintéticos** (pocos puntos) pueden pasar; la captura facial real falla al subir.

---

## Causa (probable)

1. **nginx** delante de la API con `client_max_body_size` por defecto (**1m**).
2. El multipart incluye un JSON con **~478 landmarks × N frames** (MediaPipe Face Landmarker).
3. Orden de magnitud (5 s @ 15 fps, JSON compacto `flat-xyz`):
   - ~75 frames × ~478 puntos × 3 coords ≈ **0,6–1,5 MB** solo de datos.
   - Con metadatos multipart puede **superar 1 MB** fácilmente.
4. Duraciones mayores en el panel DEV (p. ej. 30–120 s) pueden llegar a **varios MB** aunque el frontend compacte el JSON.

No es un bug del navegador: la petición llega al servidor y **el proxy o la app la rechaza por tamaño**.

---

## Qué pedimos

1. **Subir límite de cuerpo** en nginx (y equivalente) para rutas de ingestión de archivos, p. ej.:

   ```nginx
   # Bloque server o location /api/v1/landmarks/upload
   client_max_body_size 32m;
   ```

   Ajustar coherente con vídeo/audio si comparten vhost.

2. **FastAPI / Starlette** (si hay límite explícito en middleware): alinear con nginx (p. ej. 32 MB).

3. **Documentar** en OpenAPI/README el tamaño máximo por `POST /landmarks/upload` y que el cliente puede enviar:
   - `schema`: `nilo-mediapipe-face-capture-v1`
   - `landmark_encoding`: `flat-xyz` (array `[x,y,z,…]` por frame, coordenadas normalizadas 0–1).

4. **Opcional (fase 2):** aceptar `file` **gzip** (`.json.gz`) o priorizar flujo **presign + PUT MinIO** para batches grandes desde nilo-node; el navegador ya usa `/landmarks/upload` para evitar Mixed Content.

---

## Verificación

```bash
# Tras el cambio, desde la máquina del médico o curl con token:
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST "https://nilomed.eu/api/v1/landmarks/upload" \
  -H "Authorization: Bearer …" \
  -F "session_id=…" \
  -F "patient_id=…" \
  -F "start_ts=…" \
  -F "source=mediapipe" \
  -F "model_name=face_landmarker" \
  -F "file=@/tmp/face_landmarks_5s.json;type=application/json"
```

Esperado: **2xx** (no 413) con JSON de ~1–3 MB.

---

## Nota frontend

El frontend ya compacta landmarks reales (`flat-xyz`, redondeo a 4 decimales). Si tras subir el límite en nginx sigue habiendo 413 en capturas largas, conviene valorar presign desde API con URL HTTPS a MinIO o chunking en backend.