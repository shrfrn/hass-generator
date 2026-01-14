// Framework type definitions for inventory data
// Defines the shape of transformed inventory (output of transformData)

export interface InventoryMetadata {
  generated_at: string
  ha_version: string
}

export interface Floor {
  id: string
  name: string
  level: number | null
  icon: string | null
  aliases: string[]
}

export interface Area {
  id: string
  name: string
  floor_id: string | null
  icon: string | null
  aliases: string[]
  labels: string[]
}

export interface Device {
  id: string
  name: string | null
  name_by_user: string | null
  manufacturer: string | null
  model: string | null
  area_id: string | null
  labels: string[]
  disabled_by: string | null
  via_device_id: string | null
  identifiers: unknown[]
  connections: unknown[]
}

export interface Label {
  id: string
  name: string
  color: string | null
  icon: string | null
  description: string | null
}

export interface Entity {
  entity_id: string
  domain: string
  name: string | null
  state: string
  attributes: Record<string, unknown>
  area_id: string | null
  device_id: string | null
  labels: string[]
  platform: string | null
  disabled_by: string | null
  hidden_by: string | null
  icon: string | null
}

export interface Scene {
  entity_id: string
  name: string | null
  icon: string | null
}

export interface Zone {
  id: string
  name: string
  latitude: number
  longitude: number
  radius: number
  icon: string | null
  passive: boolean
}

export interface Person {
  id: string
  name: string
  user_id: string | null
  device_trackers: string[]
  picture: string | null
}

export interface InventoryData {
  metadata: InventoryMetadata
  floors: Floor[]
  areas: Area[]
  devices: Device[]
  labels: Label[]
  entities: Entity[]
  scenes: Scene[]
  zones: Zone[]
  persons: Person[]
}
