import type {
  AdminClinicianCreate,
  AdminClinicianUpdate,
  ClinicianProfileInput,
  ClinicianType,
  ClinicianUser,
} from '@/types'
import { clinicianProfileToInput } from '@/types'

const CLINICIAN_TYPES: { value: ClinicianType; label: string }[] = [
  { value: 'doctor', label: 'Médico' },
  { value: 'nurse', label: 'Enfermería' },
  { value: 'other', label: 'Otro' },
]

export interface ClinicianFormState {
  name: string
  lastname: string
  email: string
  password: string
  country: string
  is_active: boolean
  type_clinician: ClinicianType
  institution: string
  location: string
  phone_work: string
}

export const EMPTY_CLINICIAN_FORM: ClinicianFormState = {
  name: '',
  lastname: '',
  email: '',
  password: '',
  country: '',
  is_active: true,
  type_clinician: 'doctor',
  institution: '',
  location: '',
  phone_work: '',
}

export function clinicianToFormState(c: ClinicianUser): ClinicianFormState {
  const profile = c.clinician_profile
  return {
    name: c.name,
    lastname: c.lastname,
    email: c.email,
    password: '',
    country: c.country ?? '',
    is_active: c.is_active ?? true,
    type_clinician: profile.type_clinician,
    institution: profile.institution ?? '',
    location: profile.location ?? '',
    phone_work: profile.phone_work ?? '',
  }
}

function buildProfile(form: ClinicianFormState): ClinicianProfileInput {
  return {
    type_clinician: form.type_clinician,
    institution: form.institution || undefined,
    location: form.location || undefined,
    phone_work: form.phone_work || undefined,
  }
}

export function formToClinicianCreate(form: ClinicianFormState): AdminClinicianCreate {
  return {
    name: form.name.trim(),
    lastname: form.lastname.trim(),
    email: form.email.trim(),
    password: form.password,
    country: form.country || undefined,
    is_active: form.is_active,
    clinician_profile: buildProfile(form),
  }
}

export function formToClinicianUpdate(form: ClinicianFormState, existing: ClinicianUser): AdminClinicianUpdate {
  const body: AdminClinicianUpdate = {
    name: form.name.trim(),
    lastname: form.lastname.trim(),
    email: form.email.trim(),
    country: form.country || undefined,
    is_active: form.is_active,
    clinician_profile: {
      ...clinicianProfileToInput(existing.clinician_profile),
      ...buildProfile(form),
    },
  }
  if (form.password.trim()) body.password = form.password
  return body
}

interface AdminClinicianFormProps {
  form: ClinicianFormState
  onChange: (patch: Partial<ClinicianFormState>) => void
  isEdit?: boolean
}

export function AdminClinicianFormFields({ form, onChange, isEdit }: AdminClinicianFormProps) {
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
        <span>Tipo</span>
        <select
          value={form.type_clinician}
          onChange={(e) => onChange({ type_clinician: e.target.value as ClinicianType })}
        >
          {CLINICIAN_TYPES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-field">
        <span>Institución</span>
        <input value={form.institution} onChange={(e) => onChange({ institution: e.target.value })} />
      </label>
      <label className="admin-field">
        <span>Ubicación</span>
        <input value={form.location} onChange={(e) => onChange({ location: e.target.value })} />
      </label>
      <label className="admin-field">
        <span>Tel. trabajo</span>
        <input value={form.phone_work} onChange={(e) => onChange({ phone_work: e.target.value })} />
      </label>
    </div>
  )
}
