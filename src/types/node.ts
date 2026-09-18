/** Nodo tal y como lo devuelve la API (`NodeOut`). */
export interface Node {
  id: string
  name: string
  mac_address: string
  public_ip?: string | null
  ddns?: string | null
  bluetooth_enabled?: boolean
  wifi_enabled?: boolean
  wired_enabled?: boolean
  address?: string | null
  zip?: string | null
  city?: string | null
  location?: string | null
  latitude?: number | null
  longitude?: number | null
  access_password?: string | null
  last_update?: string | null
  last_update_ddns?: string | null
  created_at?: string
  updated_at?: string
}

/** Cuerpo para crear un nodo (`NodeCreate`): obligatorios name y mac_address. */
export interface NodeCreate {
  name: string
  mac_address: string
  public_ip?: string
  ddns?: string
  bluetooth_enabled?: boolean
  wifi_enabled?: boolean
  wired_enabled?: boolean
  address?: string
  zip?: string
  city?: string
  location?: string
  latitude?: number
  longitude?: number
  access_password?: string
}

/** Cuerpo para actualizar un nodo (`NodeUpdate`, parcial). */
export type NodeUpdate = Partial<NodeCreate> & {
  bluetooth_enabled?: boolean
  wifi_enabled?: boolean
  wired_enabled?: boolean
}

/** Nodo admin con telemetría (`NodeOut` en /admin/nodes). */
export interface AdminNode extends Node {
  private_ip?: string | null
  uptime_seconds?: number | null
  ssh_enabled?: boolean
  telemetry?: Record<string, unknown> | null
  last_heartbeat?: string | null
}

/** Alta de nodo vía admin — POST /admin/nodes. */
export interface AdminNodeCreate {
  name: string
  mac_address: string
  access_password?: string
  address?: string
  city?: string
  zip?: string
  location?: string
  bluetooth_enabled?: boolean
  wifi_enabled?: boolean
  wired_enabled?: boolean
  ssh_enabled?: boolean
}

/** Actualización admin — PATCH /admin/nodes/{id}. */
export type AdminNodeUpdate = Partial<AdminNodeCreate>
