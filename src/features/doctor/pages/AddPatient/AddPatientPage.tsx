import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ROOT_PATHS } from '@/router/paths'
import { COUNTRIES } from '@/constants/countries'
import { fileToDataURL } from '@/lib/fileToDataURL'
import { toast } from '@/lib/toast'
import type { PatientSex, PatientType, PatientUserCreate } from '@/types'
import { useClinicalData } from '../../context/ClinicalDataContext'
import './AddPatientPage.css'

const PATIENT_TYPES: { value: PatientType; label: string }[] = [
  { value: 'adult', label: 'Adult' },
  { value: 'child', label: 'Child' },
  { value: 'neonate', label: 'Neonate' },
  { value: 'other', label: 'Other' },
]

const SEX_OPTIONS: { value: PatientSex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

/**
 * Vista "Add Patient" — alta vía POST /users con type_user="patient".
 * Los campos clínicos van dentro de patient_profile (no en la raíz).
 */
export function AddPatientPage() {
  const navigate = useNavigate()
  const { createPatient } = useClinicalData()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    const name = (fd.get('first_name') ?? '').toString().trim()
    const lastname = (fd.get('last_name') ?? '').toString().trim()
    const email = (fd.get('email') ?? '').toString().trim()
    const password = (fd.get('password') ?? '').toString()
    const typePatient = (fd.get('patient_type') ?? '').toString() as PatientType
    const sex = (fd.get('sex') ?? '').toString() as PatientSex

    if (!name || !lastname) {
      toast.error('Indica nombre y apellidos del paciente.')
      return
    }
    if (!email) {
      toast.error('El email de la cuenta es obligatorio.')
      return
    }
    if (!password) {
      toast.error('La contraseña de la cuenta es obligatoria.')
      return
    }
    if (!typePatient) {
      toast.error('Selecciona el tipo de paciente.')
      return
    }
    if (!sex) {
      toast.error('Selecciona el sexo del paciente.')
      return
    }

    const birthdate = (fd.get('dob') ?? '').toString().trim()
    const addressRaw = (fd.get('address') ?? '').toString().trim()
    const city = (fd.get('city') ?? '').toString().trim()
    const address = [addressRaw, city].filter(Boolean).join(', ')
    const zip = (fd.get('zip') ?? '').toString().trim()
    const country = (fd.get('country') ?? '').toString().trim()
    const phone = (fd.get('phone') ?? '').toString().trim()

    const relativeName = (fd.get('relative_name') ?? '').toString().trim()
    const relativePhone = (fd.get('family_phone') ?? '').toString().trim()
    const relativeEmail = (fd.get('family_email') ?? '').toString().trim()
    const relativeContact = relativePhone || relativeEmail
    const relativeAddress = [
      (fd.get('family_address') ?? '').toString().trim(),
      (fd.get('family_zip') ?? '').toString().trim(),
      (fd.get('family_city') ?? '').toString().trim(),
    ]
      .filter(Boolean)
      .join(', ')

    const medicalRecord = (fd.get('medical_record_number') ?? '').toString().trim()
    const room = (fd.get('room') ?? '').toString().trim()
    const bed = (fd.get('bed') ?? '').toString().trim()
    const notes = (fd.get('notes') ?? '').toString().trim()
    const monitoringActive = fd.get('monitoring_active') === 'on'

    let photo: string | undefined
    if (photoFile) {
      try {
        photo = await fileToDataURL(photoFile)
      } catch {
        toast.error('No se pudo procesar la foto.')
        return
      }
    }

    const body: PatientUserCreate = {
      name,
      lastname,
      type_user: 'patient',
      email,
      password,
      patient_profile: {
        type_patient: typePatient,
        monitoring_active: monitoringActive,
        sex,
      },
    }

    if (birthdate) body.birthdate = birthdate
    if (photo) body.photo = photo
    if (address) body.address = address
    if (zip) body.zip = zip
    if (country) body.country = country
    if (phone) body.phone = phone

    if (medicalRecord) body.patient_profile.medical_record_number = medicalRecord
    if (room) body.patient_profile.room = room
    if (bed) body.patient_profile.bed = bed
    if (notes) body.patient_profile.notes = notes
    if (relativeName) body.patient_profile.relative_name = relativeName
    if (relativeContact) body.patient_profile.relative_contact = relativeContact
    if (relativeAddress) body.patient_profile.relative_address = relativeAddress

    setSubmitting(true)
    try {
      await createPatient(body)
      navigate(ROOT_PATHS.doctor)
    } catch {
      /* el cliente API ya muestra el toast de error */
    } finally {
      setSubmitting(false)
    }
  }

  function handleCancel() {
    navigate(ROOT_PATHS.doctor)
  }

  return (
    <div className="nilo-addp">
      <header className="nilo-addp__header">
        <h1 className="nilo-addp__title">Add New Patient</h1>
        <p className="nilo-addp__subtitle">
          Register a monitored patient account for 24/7 clinical monitoring.
        </p>
      </header>

      <div className="nilo-addp__grid">
        <div className="nilo-addp__form-col">
          <div className="nilo-addp__card">
            <form className="nilo-addp__form" onSubmit={handleSubmit}>
              {/* Foto de perfil */}
              <section className="nilo-addp__photo-section">
                <div className="nilo-addp__photo">
                  <button
                    type="button"
                    className="nilo-addp__photo-drop"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {photoPreview ? (
                      <img src={photoPreview} alt="Vista previa del paciente" />
                    ) : (
                      <>
                        <MaterialIcon name="add_a_photo" size={36} />
                        <span>Upload</span>
                      </>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="nilo-addp__photo-input"
                    aria-label="Upload patient photo"
                    onChange={handlePhotoChange}
                  />
                </div>
                <div className="nilo-addp__photo-text">
                  <h3>Patient Identity</h3>
                  <p>
                    Provide a clear facial photo for identity verification and AI landmark
                    mapping. Max 2 MB.
                  </p>
                </div>
              </section>

              {/* Información personal */}
              <section className="nilo-addp__fields">
                <div className="nilo-addp__field">
                  <label htmlFor="first_name">First Name</label>
                  <input id="first_name" name="first_name" type="text" placeholder="e.g., Pablo" required />
                </div>
                <div className="nilo-addp__field">
                  <label htmlFor="last_name">Last Name</label>
                  <input id="last_name" name="last_name" type="text" placeholder="e.g., Paciente" required />
                </div>
                <div className="nilo-addp__field">
                  <label htmlFor="dob">Date of Birth</label>
                  <input id="dob" name="dob" type="date" />
                </div>
                <div className="nilo-addp__field">
                  <label htmlFor="sex">Sex</label>
                  <select id="sex" name="sex" defaultValue="" required>
                    <option disabled value="">
                      Select sex
                    </option>
                    {SEX_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="nilo-addp__field">
                  <label htmlFor="patient_type">Patient Type</label>
                  <select id="patient_type" name="patient_type" defaultValue="" required>
                    <option disabled value="">
                      Select type
                    </option>
                    {PATIENT_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="nilo-addp__field">
                  <label htmlFor="medical_record_number">Medical Record No.</label>
                  <input
                    id="medical_record_number"
                    name="medical_record_number"
                    type="text"
                    placeholder="MRN-00123"
                  />
                </div>
              </section>

              {/* Cuenta de acceso (futuro login familiar) */}
              <section className="nilo-addp__section">
                <h3 className="nilo-addp__section-title">
                  <MaterialIcon name="key" size={20} />
                  Account Access
                </h3>
                <div className="nilo-addp__fields">
                  <div className="nilo-addp__field">
                    <label htmlFor="email">Email (account)</label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="familia@ejemplo.com"
                      required
                    />
                  </div>
                  <div className="nilo-addp__field">
                    <label htmlFor="password">Password</label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>
              </section>

              {/* Contacto del paciente */}
              <section className="nilo-addp__section">
                <h3 className="nilo-addp__section-title">
                  <MaterialIcon name="contact_mail" size={20} />
                  Contact Details
                </h3>
                <div className="nilo-addp__fields">
                  <div className="nilo-addp__field">
                    <label htmlFor="phone">Phone Number</label>
                    <input id="phone" name="phone" type="tel" placeholder="+34 600 111 222" />
                  </div>
                  <div className="nilo-addp__field nilo-addp__field--full">
                    <label htmlFor="address">Address</label>
                    <input id="address" name="address" type="text" placeholder="C/ Ejemplo 1" />
                  </div>
                  <div className="nilo-addp__field">
                    <label htmlFor="city">City</label>
                    <input id="city" name="city" type="text" placeholder="e.g., Madrid" />
                  </div>
                  <div className="nilo-addp__field">
                    <label htmlFor="zip">ZIP / Postal Code</label>
                    <input id="zip" name="zip" type="text" placeholder="e.g., 28001" />
                  </div>
                  <div className="nilo-addp__field nilo-addp__field--full">
                    <label htmlFor="country">Country</label>
                    <select id="country" name="country" defaultValue="">
                      <option value="">Select country</option>
                      {COUNTRIES.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              {/* Ubicación clínica */}
              <section className="nilo-addp__section">
                <h3 className="nilo-addp__section-title">
                  <MaterialIcon name="local_hospital" size={20} />
                  Clinical Location
                </h3>
                <div className="nilo-addp__fields">
                  <div className="nilo-addp__field">
                    <label htmlFor="room">Room</label>
                    <input id="room" name="room" type="text" placeholder="e.g., UCI" />
                  </div>
                  <div className="nilo-addp__field">
                    <label htmlFor="bed">Bed</label>
                    <input id="bed" name="bed" type="text" placeholder="e.g., 3" />
                  </div>
                  <div className="nilo-addp__field nilo-addp__field--full">
                    <label htmlFor="notes">Notes</label>
                    <input id="notes" name="notes" type="text" placeholder="Clinical notes…" />
                  </div>
                  <div className="nilo-addp__field nilo-addp__field--full">
                    <label className="nilo-addp__checkbox">
                      <input type="checkbox" name="monitoring_active" defaultChecked />
                      <span>Start monitoring immediately</span>
                    </label>
                  </div>
                </div>
              </section>

              {/* Contacto de familiar */}
              <section className="nilo-addp__section">
                <h3 className="nilo-addp__section-title">
                  <MaterialIcon name="family_restroom" size={20} />
                  Family Contact
                </h3>
                <div className="nilo-addp__fields">
                  <div className="nilo-addp__field nilo-addp__field--full">
                    <label htmlFor="relative_name">Relative Name</label>
                    <input
                      id="relative_name"
                      name="relative_name"
                      type="text"
                      placeholder="e.g., María García"
                    />
                  </div>
                  <div className="nilo-addp__field">
                    <label htmlFor="family_phone">Phone Number</label>
                    <input
                      id="family_phone"
                      name="family_phone"
                      type="tel"
                      placeholder="+34 600 999 888"
                    />
                  </div>
                  <div className="nilo-addp__field">
                    <label htmlFor="family_email">Email Address</label>
                    <input
                      id="family_email"
                      name="family_email"
                      type="email"
                      placeholder="relative@example.com"
                    />
                  </div>
                  <div className="nilo-addp__field nilo-addp__field--full">
                    <label htmlFor="family_address">Address</label>
                    <input
                      id="family_address"
                      name="family_address"
                      type="text"
                      placeholder="C/ Familiar 1"
                    />
                  </div>
                  <div className="nilo-addp__field">
                    <label htmlFor="family_zip">ZIP / Postal Code</label>
                    <input id="family_zip" name="family_zip" type="text" placeholder="e.g., 28001" />
                  </div>
                  <div className="nilo-addp__field">
                    <label htmlFor="family_city">City</label>
                    <input id="family_city" name="family_city" type="text" placeholder="e.g., Madrid" />
                  </div>
                </div>
              </section>

              <div className="nilo-addp__actions">
                <button
                  type="button"
                  className="nilo-addp__btn nilo-addp__btn--ghost"
                  onClick={handleCancel}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="nilo-addp__btn nilo-addp__btn--primary"
                  disabled={submitting}
                >
                  <MaterialIcon name="save" size={18} />
                  {submitting ? 'Saving…' : 'Save Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <aside className="nilo-addp__aside" aria-hidden="true" />
      </div>
    </div>
  )
}
