# Mensaje para agente NILO-backend — DELETE recursos clínicos (Explorar)

Copia este bloque al chat de **NILO-backend**.

---

## Contexto

En **NILO-frontend** (Explorar → sesión) el clínico puede **eliminar** registros de:

- landmarks (cara / postura)
- audio (notas de voz y ambiente)
- notas de texto
- episodios de dolor
- segmentos de vídeo
- lecturas fisiológicas

Flujo UI: botón papelera → **ConfirmDialog** (“no se puede deshacer”) → `DELETE` API.

Contrato front documentado en: `NILO-frontend/docs/18.explore_clinical_delete.md`.

Servicios front que ya llaman `api.delete`:

- `landmarksService.remove(id)` → `DELETE /landmarks/{id}`
- `audioRecordingService.remove(id)` → `DELETE /audio/{id}`
- `monitoringSessionService.deleteTextNote(sessionId, noteId)` → `DELETE /sessions/{session_id}/text-notes/{note_id}`
- `painEventService.remove(id)` → `DELETE /pain-events/{id}`
- `videoSegmentService.remove(segmentId)` → `DELETE /sessions/video-segments/{segment_id}`
- `physiologicalService.remove(id)` → `DELETE /physiological/{id}`

**Respuesta esperada en todos:** `204 No Content` (sin cuerpo).

**Autorización:** `require_staff` (mismo criterio que crear/subir).

---

## Comportamiento requerido

1. **MongoDB:** borrar el documento Beanie.
2. **MinIO:** si el recurso tiene `object_key` (o claves de vídeo/dolor), llamar `remove_object` en el **bucket** del documento. Idempotente: si el objeto ya no existe, no fallar el DELETE (el índice clínico debe poder limpiarse).
3. **Sesión / paciente:** validar que el recurso pertenece al paciente/sesión esperado (404 si no existe).
4. Tras borrar, `GET …/sessions/{id}/overview` debe reflejar conteos actualizados (`landmarks_batches`, `audio_clips`, `pain_events`, `text_notes`, `video_segments`, `physiological_readings`).

---

## Endpoints a implementar

### 1. Landmarks

```http
DELETE /api/v1/landmarks/{landmarks_id}
```

Modelo: `BodyLandmarks` — campos `bucket`, `object_key`.

MinIO: borrar `object_key`.

---

### 2. Audio

```http
DELETE /api/v1/audio/{audio_id}
```

Modelo: `AudioRecording` — `bucket`, `object_key`.

MinIO: borrar `object_key`.

---

### 3. Nota de texto (solo Mongo)

```http
DELETE /api/v1/sessions/{session_id}/text-notes/{note_id}
```

Modelo: `SessionTextNote` — sin MinIO.

Validar `note.session_id == session_id`.

---

### 4. Episodio de dolor

```http
DELETE /api/v1/pain-events/{pain_event_id}
```

Modelo: `PainEvent` — `bucket`, `video_object_key`, opcional `landmarks_object_key`.

MinIO: borrar **ambas** claves si están definidas.

---

### 5. Segmento de vídeo

```http
DELETE /api/v1/sessions/video-segments/{segment_id}
```

Modelo: `VideoSegment` (colección `video_segments`) — `bucket`, `object_key`.

*(El listado en Explorar usa `GET …/media-access`; los `id` de ítems `kind=video` deben ser el `segment_id`.)*

MinIO: borrar `object_key`.

---

### 6. Fisiológico (solo Mongo)

```http
DELETE /api/v1/physiological/{reading_id}
```

Modelo: `PhysiologicalReading` — sin MinIO.

---

## MinIO — helper recomendado

En `app/storage/minio_client.py`:

```python
def delete_object(object_key: str, bucket: str | None = None) -> None:
    """No-op si el objeto no existe."""
```

Servicio compartido opcional `app/services/clinical_delete.py`:

- `delete_minio_keys(bucket, *keys)`
- `async def delete_clinical_document(doc)` → borra claves conocidas + `await doc.delete()`

Patrón por modelo:

| Modelo | Claves MinIO |
|--------|----------------|
| BodyLandmarks | `object_key` |
| AudioRecording | `object_key` |
| PainEvent | `video_object_key`, `landmarks_object_key` |
| VideoSegment | `object_key` |

---

## Errores

| Caso | HTTP |
|------|------|
| Id no encontrado | 404 |
| Sin permisos staff | 403 (según deps actuales) |
| Objeto MinIO ausente pero doc existe | **204 igualmente** (limpiar Mongo; log warning) |

No usar 409 salvo regla de negocio explícita.

---

## Pruebas manuales sugeridas

1. Subir un landmarks/audio/vídeo de prueba en sesión → Explorar → eliminar → `GET /landmarks?…&storage_ready=true` sin el id.
2. Comprobar que el objeto desaparece de MinIO (`mc ls` o consola).
3. `GET /sessions/{id}/overview` conteos −1.
4. Nota texto y fisiológico: solo Mongo, DELETE 204.

---

## Referencias en repo backend

- Modelos: `app/models/landmarks.py`, `audio.py`, `pain_event.py`, `session_text_note.py`, `monitoring_session.py` (VideoSegment), `physiological.py`
- Routers: `app/api/v1/endpoints/landmarks.py`, `audio.py`, `session_text_notes.py`, `pain_events.py`, `sessions.py`, `physiological.py`
- Acceso media: `docs/12.clinical_media_access.md`

---

## Criterio de aceptación (con front desplegado)

- Desde `https://nilomed.eu` → paciente → Explorar → cualquier categoría → eliminar con confirmación → **204**, fila desaparece, overview actualizado, sin objeto huérfano en MinIO (para tipos con fichero).