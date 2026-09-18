import type { AdminNode, AdminNodeCreate, AdminNodeUpdate } from '@/types'

export interface NodeFormState {
  name: string
  mac_address: string
  access_password: string
  address: string
  city: string
  zip: string
  location: string
  bluetooth_enabled: boolean
  wifi_enabled: boolean
  wired_enabled: boolean
  ssh_enabled: boolean
}

export const EMPTY_NODE_FORM: NodeFormState = {
  name: '',
  mac_address: '',
  access_password: '',
  address: '',
  city: '',
  zip: '',
  location: '',
  bluetooth_enabled: false,
  wifi_enabled: true,
  wired_enabled: true,
  ssh_enabled: false,
}

export function nodeToFormState(n: AdminNode): NodeFormState {
  return {
    name: n.name,
    mac_address: n.mac_address,
    access_password: '',
    address: n.address ?? '',
    city: n.city ?? '',
    zip: n.zip ?? '',
    location: n.location ?? '',
    bluetooth_enabled: n.bluetooth_enabled ?? false,
    wifi_enabled: n.wifi_enabled ?? true,
    wired_enabled: n.wired_enabled ?? true,
    ssh_enabled: n.ssh_enabled ?? false,
  }
}

export function formToNodeCreate(form: NodeFormState): AdminNodeCreate {
  return {
    name: form.name.trim(),
    mac_address: form.mac_address.trim(),
    access_password: form.access_password || undefined,
    address: form.address || undefined,
    city: form.city || undefined,
    zip: form.zip || undefined,
    location: form.location || undefined,
    bluetooth_enabled: form.bluetooth_enabled,
    wifi_enabled: form.wifi_enabled,
    wired_enabled: form.wired_enabled,
    ssh_enabled: form.ssh_enabled,
  }
}

export function formToNodeUpdate(form: NodeFormState): AdminNodeUpdate {
  const body: AdminNodeUpdate = {
    name: form.name.trim(),
    mac_address: form.mac_address.trim(),
    address: form.address || undefined,
    city: form.city || undefined,
    zip: form.zip || undefined,
    location: form.location || undefined,
    bluetooth_enabled: form.bluetooth_enabled,
    wifi_enabled: form.wifi_enabled,
    wired_enabled: form.wired_enabled,
    ssh_enabled: form.ssh_enabled,
  }
  if (form.access_password.trim()) body.access_password = form.access_password
  return body
}

interface AdminNodeFormProps {
  form: NodeFormState
  onChange: (patch: Partial<NodeFormState>) => void
  isEdit?: boolean
}

function BoolSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <select value={value ? '1' : '0'} onChange={(e) => onChange(e.target.value === '1')}>
        <option value="1">Sí</option>
        <option value="0">No</option>
      </select>
    </label>
  )
}

export function AdminNodeFormFields({ form, onChange, isEdit }: AdminNodeFormProps) {
  return (
    <div className="admin-form-grid">
      <label className="admin-field">
        <span>Nombre *</span>
        <input value={form.name} onChange={(e) => onChange({ name: e.target.value })} required />
      </label>
      <label className="admin-field">
        <span>MAC *</span>
        <input
          value={form.mac_address}
          onChange={(e) => onChange({ mac_address: e.target.value })}
          required
          placeholder="AA:BB:CC:DD:EE:FF"
        />
      </label>
      <label className="admin-field admin-form-grid--wide">
        <span>{isEdit ? 'Contraseña acceso (opcional)' : 'Contraseña acceso'}</span>
        <input
          type="password"
          value={form.access_password}
          onChange={(e) => onChange({ access_password: e.target.value })}
          autoComplete="new-password"
        />
      </label>
      <label className="admin-field admin-form-grid--wide">
        <span>Dirección</span>
        <input value={form.address} onChange={(e) => onChange({ address: e.target.value })} />
      </label>
      <label className="admin-field">
        <span>Ciudad</span>
        <input value={form.city} onChange={(e) => onChange({ city: e.target.value })} />
      </label>
      <label className="admin-field">
        <span>CP</span>
        <input value={form.zip} onChange={(e) => onChange({ zip: e.target.value })} />
      </label>
      <label className="admin-field admin-form-grid--wide">
        <span>Ubicación / referencia</span>
        <input value={form.location} onChange={(e) => onChange({ location: e.target.value })} />
      </label>

      <div className="admin-form-section">Conectividad</div>

      <BoolSelect label="Bluetooth" value={form.bluetooth_enabled} onChange={(v) => onChange({ bluetooth_enabled: v })} />
      <BoolSelect label="WiFi" value={form.wifi_enabled} onChange={(v) => onChange({ wifi_enabled: v })} />
      <BoolSelect label="Cableado" value={form.wired_enabled} onChange={(v) => onChange({ wired_enabled: v })} />
      <BoolSelect label="SSH" value={form.ssh_enabled} onChange={(v) => onChange({ ssh_enabled: v })} />
    </div>
  )
}
