import type { AdminPatientCreate, AdminPatientUpdate, PatientProfileInput, PatientSex, PatientType, PatientUser } from '@/types'
import { patientProfileToInput } from '@/types'

const PATIENT_TYPES: { value: PatientType; label: string }[] = [
  { value: 'adult', label: 'Adulto' },
  { value: 'child', label: 'Niño' },
  { value: 'neonate', label: 'Neonato' },
  { value: 'other', label: 'Otro' },
]

const SEX_OPTIONS: { value: PatientSex; label: string }[] = [
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Femenino' },
  { value: 'other', label: 'Otro' },
  { value: 'unknown', label: 'Desconocido' },
]

export interface PatientFormState {
  name: string
  lastname: string
  email: string
  password: string
  birthdate: string
  address: string
  zip: string
  country: string
  phone: string
  is_active: boolean
  type_patient: PatientType
  monitoring_active: boolean
  medical_record_number: string
  sex: PatientSex
  room: string
  bed: string
  notes: string
  relative_name: string
  relative_contact: string
  relative_address: string
}

export const EMPTY_PATIENT_FORM: PatientFormState = {
  name: '',
  lastname: '',
  email: '',
  password: '',
  birthdate: '',
  address: '',
  zip: '',
  country: '',
  phone: '',
  is_active: true,
  type_patient: 'adult',
  monitoring_active: true,
  medical_record_number: '',
  sex: 'unknown',
  room: '',
  bed: '',
  notes: '',
  relative_name: '',
  relative_contact: '',
  relative_address: '',
}

export function patientToFormState(p: PatientUser): PatientFormState {
  const profile = p.patient_profile
  return {
    name: p.name,
    lastname: p.lastname,
    email: p.email,
    password: '',
    birthdate: p.birthdate?.slice(0, 10) ?? '',
    address: p.address ?? '',
    zip: p.zip ?? '',
    country: p.country ?? '',
    phone: p.phone ?? '',
    is_active: p.is_active ?? true,
    type_patient: profile.type_patient,
    monitoring_active: profile.monitoring_active,
    medical_record_number: profile.medical_record_number ?? '',
    sex: profile.sex ?? 'unknown',
    room: profile.room ?? '',
    bed: profile.bed ?? '',
    notes: profile.notes ?? '',
    relative_name: profile.relative_name ?? '',
    relative_contact: profile.relative_contact ?? '',
    relative_address: profile.relative_address ?? '',
  }
}

function buildProfile(form: PatientFormState): PatientProfileInput {
  return {
    type_patient: form.type_patient,
    monitoring_active: form.monitoring_active,
    medical_record_number: form.medical_record_number || undefined,
    sex: form.sex,
    room: form.room || undefined,
    bed: form.bed || undefined,
    notes: form.notes || undefined,
    relative_name: form.relative_name || undefined,
    relative_contact: form.relative_contact || undefined,
    relative_address: form.relative_address || undefined,
  }
}

export function formToPatientCreate(form: PatientFormState): AdminPatientCreate {
  return {
    name: form.name.trim(),
    lastname: form.lastname.trim(),
    email: form.email.trim(),
    password: form.password,
    birthdate: form.birthdate || undefined,
    address: form.address || undefined,
    zip: form.zip || undefined,
    country: form.country || undefined,
    phone: form.phone || undefined,
    is_active: form.is_active,
    patient_profile: buildProfile(form),
  }
}

export function formToPatientUpdate(form: PatientFormState, existing: PatientUser): AdminPatientUpdate {
  const body: AdminPatientUpdate = {
    name: form.name.trim(),
    lastname: form.lastname.trim(),
    email: form.email.trim(),
    birthdate: form.birthdate || undefined,
    address: form.address || undefined,
    zip: form.zip || undefined,
    country: form.country || undefined,
    phone: form.phone || undefined,
    is_active: form.is_active,
    patient_profile: {
      ...patientProfileToInput(existing.patient_profile),
      ...buildProfile(form),
    },
  }
  if (form.password.trim()) body.password = form.password
  return body
}

interface AdminPatientFormProps {
  form: PatientFormState
  onChange: (patch: Partial<PatientFormState>) => void
  isEdit?: boolean
}

export function AdminPatientFormFields({ form, onChange, isEdit }: AdminPatientFormProps) {
  return (
    <div className="admin-form-grid">
      <label className="admin-field">
        <span>Nombre *</span>
        <input value={form.name} onChange={(e) => onChange({ name: e.target.value })} required />
      </label>
      <label className="admin-field">
        <span>Apellidos *</span>
        <input value={form.lastname} onChange={(e) => onChange({ lastname: e.target.value })} required />
      </label>
      <label className="admin-field">
        <span>Email *</span>
        <input type="email" value={form.email} onChange={(e) => onChange({ email: e.target.value })} required />
      </label>
      <label className="admin-field">
        <span>{isEdit ? 'Contraseña (opcional)' : 'Contraseña *'}</span>
        <input
          type="password"
          value={form.password}
          onChange={(e) => onChange({ password: e.target.value })}
          required={!isEdit}
          autoComplete="new-password"
        />
      </label>
      <label className="admin-field">
        <span>Fecha nacimiento</span>
        <input type="date" value={form.birthdate} onChange={(e) => onChange({ birthdate: e.target.value })} />
      </label>
      <label className="admin-field">
        <span>Teléfono</span>
        <input value={form.phone} onChange={(e) => onChange({ phone: e.target.value })} />
      </label>
      <label className="admin-field admin-form-grid--wide">
        <span>Dirección</span>
        <input value={form.address} onChange={(e) => onChange({ address: e.target.value })} />
      </label>
      <label className="admin-field">
        <span>CP</span>
        <input value={form.zip} onChange={(e) => onChange({ zip: e.target.value })} />
      </label>
      <label className="admin-field">
        <span>País</span>
        <input value={form.country} onChange={(e) => onChange({ country: e.target.value })} />
      </label>
      <label className="admin-field">
        <span>Activo</span>
        <select
          value={form.is_active ? '1' : '0'}
          onChange={(e) => onChange({ is_active: e.target.value === '1' })}
        >
          <option value="1">Sí</option>
          <option value="0">No</option>
        </select>
      </label>

      <div className="admin-form-section">Perfil clínico</div>

      <label className="admin-field">
        <span>Tipo paciente</span>
        <select
          value={form.type_patient}
          onChange={(e) => onChange({ type_patient: e.target.value as PatientType })}
        >
          {PATIENT_TYPES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-field">
        <span>Sexo</span>
        <select value={form.sex} onChange={(e) => onChange({ sex: e.target.value as PatientSex })}>
          {SEX_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-field">
        <span>Nº historia</span>
        <input
          value={form.medical_record_number}
          onChange={(e) => onChange({ medical_record_number: e.target.value })}
        />
      </label>
      <label className="admin-field">
        <span>Monitorización</span>
        <select
          value={form.monitoring_active ? '1' : '0'}
          onChange={(e) => onChange({ monitoring_active: e.target.value === '1' })}
        >
          <option value="1">Activa</option>
          <option value="0">Inactiva</option>
        </select>
      </label>
      <label className="admin-field">
        <span>Habitación</span>
        <input value={form.room} onChange={(e) => onChange({ room: e.target.value })} />
      </label>
      <label className="admin-field">
        <span>Cama</span>
        <input value={form.bed} onChange={(e) => onChange({ bed: e.target.value })} />
      </label>
      <label className="admin-field admin-form-grid--wide">
        <span>Notas</span>
        <textarea value={form.notes} onChange={(e) => onChange({ notes: e.target.value })} rows={2} />
      </label>

      <div className="admin-form-section">Familiar / contacto</div>

      <label className="admin-field">
        <span>Nombre familiar</span>
        <input value={form.relative_name} onChange={(e) => onChange({ relative_name: e.target.value })} />
      </label>
      <label className="admin-field">
        <span>Contacto familiar</span>
        <input value={form.relative_contact} onChange={(e) => onChange({ relative_contact: e.target.value })} />
      </label>
      <label className="admin-field admin-form-grid--wide">
        <span>Dirección familiar</span>
        <input value={form.relative_address} onChange={(e) => onChange({ relative_address: e.target.value })} />
      </label>
    </div>
  )
}
