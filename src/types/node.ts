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
export type NodeUpdate = Partial<NodeCreate>
