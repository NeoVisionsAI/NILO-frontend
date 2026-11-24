# Mensaje para el agente backend — Monitorización ↔ sesión activa

**Copia desde aquí hacia el chat del repo `NILO-backend`.**

---

## Contexto

En **NILO-frontend** la ficha del paciente tiene un toggle «Monitorización activa». El comportamiento clínico acordado es:

- Un paciente **sin** monitorización no debe tener sesión abierta ni ingestión asociada a un periodo activo.
- Al **activar** monitorización se abre **una** `MonitoringSession` (contenedor temporal en MongoDB). Todo lo que se capture (vídeo, audio, vitales, landmarks, dolor, notas…) debe ir con ese `session_id` hasta que se desactive.
- Al **desactivar** se **cierra** esa sesión (`status: completed`, `ended_at`) y se apaga el flag.
- En UI se muestra un **UUID** (`external_session_id`) para correlación con nilo-node y copia al portapapeles; el id interno de Mongo (`MonitoringSession.id`) es el que usan las APIs de ingestión.

Hoy el frontend hace esto en **varios pasos** (no atómico):

1. `POST /sessions` con `patient_id` clínico, `node_id`, `external_session_id: <uuid>`
2. `PATCH /users/{user_id}` con `patient_profile` completo y `monitoring_active: true` (sin persistir `active_session_id`)
3. Al apagar: `POST /sessions/{id}/end` + `PATCH` con `monitoring_active: false`

Problemas sin backend dedicado:

- Condición de carrera si dos clientes activan a la vez.
- `monitoring_active: true` sin sesión si falla el `POST /sessions`.
- El **nodo** no tiene una fuente de verdad en el usuario (`GET /users/{id}`) para saber qué sesión está activa.
- `PATCH /users` con solo `monitoring_active` no crea ni cierra sesión si alguien usa la API antigua.

**Referencia frontend:** `NILO-frontend/src/services/patient-monitoring.service.ts`, `docs/12.monitoring_toggle_session.md`.

**Referencia sesiones existentes:** `NILO-backend/docs/04.monitoring_sessions.md`.

---

## Objetivo del backend

Implementar un **ciclo de vida atómico** monitorización ↔ sesión, con campos persistidos y endpoints dedicados. El frontend se actualizará para llamar a esos endpoints en lugar del flujo en 3 pasos (cuando estén disponibles).

---

## 1. Modelo de datos

### 1.1 `User.patient_profile` (`PatientProfile` embebido)

Añadir (solo gestionado por servidor, **no** aceptar en `PatientProfileIn` del cliente):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `active_session_id` | `PydanticObjectId \| None` | Id de la `MonitoringSession` con `status == active` mientras `monitoring_active == true`. `null` si monitorización off. |

### 1.2 `Patient` clínico (`app/models/patient.py`)

Mismo campo:

| Campo | Tipo |
|-------|------|
| `active_session_id` | `PydanticObjectId \| None` |

Sincronizar en `app/services/clinical_patient.py` → `sync_clinical_patient` (junto con `monitoring_active`, `node_id`, etc.).

### 1.3 Schemas

- **`PatientProfileOut`**: incluir `active_session_id`.
- **`PatientProfileIn` / `UserUpdate`**: **no** permitir que el cliente fije `active_session_id` (ignorar si viene en el JSON o validar y rechazar).
- **`PatientOut`**: incluir `active_session_id` si aplica.

No hace falta migración de datos legacy: pacientes con `monitoring_active: true` y sin sesión pueden quedar inconsistentes hasta que el clínico toggle off/on o un script de reparación.

---

## 2. Servicio `monitoring_lifecycle`

Crear p. ej. `app/services/monitoring_lifecycle.py` con:

### `start_patient_monitoring(user: User) -> MonitoringSession`

1. Verificar `type_user == patient` y `patient_profile` presente.
2. `clinical = await sync_clinical_patient(user)`; si `None` → **400** «No clinical patient record linked».
3. **Idempotencia**: si `profile.active_session_id` apunta a sesión **active** del mismo `patient_id` clínico → actualizar flags, devolver esa sesión.
4. Cerrar cualquier otra sesión **active** huérfana del mismo `patient_id` clínico (`completed` + `ended_at`).
5. Crear `MonitoringSession`:
   - `patient_id` = clinical.id
   - `node_id` = clinical.node_id o profile.node_id
   - `external_session_id` = `str(uuid.uuid4())`
   - defaults `archive_chunk_seconds` / `hls_segment_seconds` desde settings
6. **Opcional pero recomendado:** marcador MinIO  
   `patients/{clinical_patient_id}/sessions/{session_id}/.session` (objeto vacío) vía `minio_client` — fallo MinIO no debe impedir crear sesión (log + continuar).
7. `profile.monitoring_active = True`, `profile.active_session_id = session.id`, guardar `User`.
8. `clinical.monitoring_active = True`, `clinical.active_session_id = session.id`, guardar `Patient`.
9. Devolver la sesión.

### `stop_patient_monitoring(user: User) -> None`

1. Mismas comprobaciones de rol.
2. Si `active_session_id` → cargar sesión; si `active`, `POST` equivalente interno: `completed`, `ended_at = utcnow()`.
3. `profile.monitoring_active = False`, `profile.active_session_id = None`, guardar usuario + clinical.

---

## 3. Endpoints API

Base: `/api/v1/users` (mismo router que `PATCH /users/{id}`).

Autenticación: staff (clinician/root), mismas reglas `_can_manage` que update user.

### `POST /users/{user_id}/monitoring/start`

- **Response 200/201** (elegir una; si 201, coherente con crear sesión):

```json
{
  "user": { "...": "UserOut con patient_profile.active_session_id" },
  "session": { "...": "MonitoringSessionOut" }
}
```

O solo `UserOut` si prefieren menos payload (el frontend puede leer `active_session_id` y opcionalmente `GET /sessions/{id}` para `external_session_id`).

- Errores: 404 user, 403, 400 sin clinical patient.

### `POST /users/{user_id}/monitoring/stop`

- **Response 200**: `UserOut` (`monitoring_active: false`, `active_session_id: null`).

### Interceptar `PATCH /users/{user_id}` (recomendado)

Cuando el payload incluya `patient_profile` y cambie `monitoring_active`:

- `false → true` → llamar `start_patient_monitoring` (no confiar en que el cliente haya creado la sesión).
- `true → false` → llamar `stop_patient_monitoring`.

Si solo cambian otros campos del perfil sin tocar `monitoring_active`, flujo actual.

Importante: el frontend hoy manda **objeto completo** `patient_profile` en PATCH; comparar valor anterior vs nuevo de `monitoring_active`.

---

## 4. Contrato para nilo-node / ingestión

Documentar en `04.monitoring_sessions.md` o nuevo apartado:

1. `GET /users/{id}` o listado de pacientes monitorizados: leer `patient_profile.monitoring_active` y `patient_profile.active_session_id`.
2. Ingestión (audio, vídeo, etc.) exige `session_id == active_session_id` y sesión `status == active` (ya existe `require_active_ingestion`).
3. Alternativa: `GET /patients?node_id=...` con `active_session_id` en `PatientOut` para resolver por nodo.

---

## 5. MinIO

No es obligatorio pre-crear árbol completo. Las claves ya usan `session_id` en paths al subir. El marcador `.session` es opcional para auditoría o scripts de limpieza.

---

## 6. Criterios de aceptación (checklist)

- [ ] `active_session_id` en User profile y Patient clínico, expuesto en Out, no editable por cliente en In.
- [ ] `POST .../monitoring/start` crea sesión + flags en una operación coherente.
- [ ] `POST .../monitoring/stop` cierra sesión + limpia flags.
- [ ] PATCH con cambio de `monitoring_active` delega al lifecycle (sin sesión huérfana).
- [ ] `sync_clinical_patient` copia `active_session_id`.
- [ ] Tests o manual: activar → `GET /sessions/{active_session_id}` status `active`; desactivar → `completed`; `active_session_id` null.
- [ ] Actualizar `NILO-backend/docs/04.monitoring_sessions.md` (flujo clinician + nilo-node).

---

## 7. Cambio esperado en frontend (después del deploy backend)

El agente frontend hará:

- Sustituir `patientMonitoringService.start/stop` por `POST /users/{id}/monitoring/start|stop`.
- Mostrar `active_session_id` desde `UserOut` sin listar sesiones para adivinar.
- Mantener visualización de `external_session_id` desde el objeto `session` en la respuesta de start.

No hace falta esperar al frontend para desplegar el backend: el flujo actual de 3 pasos sigue funcionando hasta el cambio de cliente.

---

## 8. Snippet de referencia (servicio — orientativo)

El agente puede adaptar desde el borrador que ya se preparó en conversación (lifecycle + minio `ensure_session_storage_root`). Estructura mínima ya descrita en sección 2.

**Fin del mensaje.**