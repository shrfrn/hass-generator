// Framework type definitions for generator config
// These types define the SHAPE of configs and are stable across installations
// Instance-specific types (AreaId, EntityId) stay in each installation's hass-config

// ─────────────────────────────────────────────────────────────────────────────
// SYNCED ENTITIES TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Light control capabilities */
export type LightControl = 'on' | 'off' | 'brightness' | 'color_temp' | 'rgb' | 'hs' | 'xy' | 'effect'

/** Shorthand strings for common control sets */
export type ControlsShorthand = 'toggle' | 'dimmable' | 'tunable' | 'rgb'

/** Dimming behavior configuration (for generator-built automations) */
export interface DimConfig {
	/** Dimming style: 'step' for discrete steps, 'hold' for continuous while holding */
	style: 'step' | 'hold'

	/** Step percentage for step dimming (default: 10) */
	step_percent?: number

	/** Transition duration in seconds for hold dimming (default: 4) */
	transition?: number
}

/** Blueprint configuration for device control */
export interface BlueprintConfig {
	/** Path to blueprint file (relative to blueprints/automation/) */
	path: string

	/** Blueprint input values - passed directly to use_blueprint.input */
	input: Record<string, unknown>
}

/** Element identified by entity_id (lights, switches, or remotes exposed as entities) */
export interface SyncedEntity {
	/** Entity ID (e.g., 'light.mb_soc_bulb') */
	entity_id: string

	/** Whether this element participates in bidirectional state sync */
	sync: boolean

	/**
	 * Control capabilities for this element.
	 * Determines what template actions are generated.
	 * @default ['on', 'off']
	 */
	controls?: LightControl[] | ControlsShorthand
}

/** Base properties for device-identified elements */
interface SyncedDeviceBase {
	/** Device ID for elements that use device triggers (e.g., IKEA remotes via Z2M) */
	device_id: string

	/** Whether this element participates in bidirectional state sync */
	sync: boolean

	/**
	 * Optional name for this device, used in automation naming.
	 * For blueprint devices, this becomes part of the automation ID and alias.
	 * @example 'shahar' -> automation ID: 'fixture_remote_shahar'
	 */
	name?: string

	/**
	 * Control capabilities for this element.
	 * Determines what template actions are generated.
	 * @default ['on', 'off']
	 */
	controls?: LightControl[] | ControlsShorthand
}

/**
 * Element identified by device_id (remotes/buttons via device triggers).
 * Specify either `dim` OR `blueprint`, not both. Omit both for on/off only.
 */
export type SyncedDevice = SyncedDeviceBase & (
	| { dim: DimConfig; blueprint?: never }
	| { dim?: never; blueprint: BlueprintConfig }
	| { dim?: never; blueprint?: never }
)

/** Element within a synced fixture - identified by entity_id or device_id */
export type SyncedFixtureElement = SyncedEntity | SyncedDevice

/** A fixture grouping multiple entities that should sync together */
export interface SyncedFixture {
	/** Human-readable name for the fixture */
	name: string

	/**
	 * Optional MDI icon for the fixture (e.g. 'mdi:wall-sconce-round').
	 * Applied to the generated template light and dashboard card; if omitted, HA default is used.
	 */
	icon?: string

	/**
	 * Power control entity ID, or null if always powered.
	 * - If set: generates a template light with boot-wait logic
	 * - If null + multiple dimmables: generates a light group
	 * - If null + single dimmable: uses the bulb directly
	 */
	power: string | null

	/**
	 * Hardware power-on brightness level (0-255).
	 * Used as initial value for brightness helper and turn_on reset.
	 * Should match the bulb's configured power-on behavior.
	 * @default 254
	 */
	default_brightness?: number

	/** Elements in this fixture (entities and/or devices) */
	entities: SyncedFixtureElement[]
}

// ─────────────────────────────────────────────────────────────────────────────
// AREA CONFIG
// ─────────────────────────────────────────────────────────────────────────────

export interface AreaConfig {
  /** Override vacancy timer duration for this area */
  vacancy_timer_duration?: string

  /** Entity IDs to add to the light group */
  include_in_group?: string[]

  /** Entity IDs to exclude from the light group */
  exclude_from_group?: string[]

  /** Labels to exclude (overrides global excluded_labels for this area) */
  excluded_labels?: string[]

  /** Labels to include (overrides global excluded_labels for this area) */
  included_labels?: string[]

  /**
   * Synced entity fixtures for this area.
   * Generates sync automations, template lights, and/or light groups.
   * @example
   * {
   *   mb_standing_lamp: {
   *     name: 'Master Bedroom Standing Lamp',
   *     power: null,
   *     entities: [
   *       { entity_id: 'switch.mb_soc', sync: true },
   *       { entity_id: 'light.mb_soc_bulb', sync: true, controls: 'dimmable' },
   *     ],
   *   },
   * }
   */
  syncedEntities?: Record<string, SyncedFixture>
}

export interface GeneratorConfig {
  /** Schema version - do not change manually */
  schemaVersion: number

  /** Default vacancy timer duration (HH:MM:SS format) */
  default_vacancy_duration?: string

  /** Labels to exclude from ALL light groups by default */
  excluded_labels?: string[]

  /** Labels to always include in light groups */
  included_labels?: string[]

  /** Per-area configuration overrides */
  areas?: Record<string, AreaConfig>
}

// ─────────────────────────────────────────────────────────────────────────────
// MEDIA/TV CONTROL TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Supported media platforms */
export type MediaPlatform = 'apple_tv' | 'android_tv'

/** Media source button configuration */
export interface MediaSource {
	/** Display name */
	name: string

	/** MDI icon (e.g., 'mdi:netflix') */
	icon: string

	/** Source name as recognized by media_player.select_source */
	source: string
}

/** Media/TV control configuration for an area */
export interface MediaConfig {
	/** Platform type - determines remote behavior and popup hash */
	platform: MediaPlatform

	/** Remote entity ID (e.g., 'remote.slvn') */
	remote_entity: string

	/** Optional source buttons - defaults provided if omitted */
	sources?: MediaSource[]
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD AREA CONFIG
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardAreaConfig {
  /** Lights to exclude from the Lights section */
  excluded_lights?: string[]

  /** Entities to add to the Lights section (display only) */
  included_lights?: string[]

  /** Scenes from other areas to include in this area's detailed view */
  included_scenes?: string[]

  /** Scenes to exclude from this area's detailed view (show in another area instead) */
  excluded_scenes?: string[]

  /** User IDs that can see this area */
  visible_to_users?: string[]

  /** Media/TV control configuration */
  media?: MediaConfig
}

/** Available dashboard templates */
export type DashboardTemplate = 'bubble' | 'bubble-views' | 'mushroom'

export interface DashboardConfig {
  /** Schema version - do not change manually */
  schemaVersion: number

  /** Dashboard template to use */
  template: DashboardTemplate

  /** Output file path (relative to project root) */
  output: string

  /** Dashboard view title */
  dashboard_name?: string

  /** URL path for HA registration */
  dashboard_path?: string

  /** Title shown in HA sidebar */
  dashboard_title?: string

  /** MDI icon for sidebar */
  dashboard_icon?: string

  /** Whether to show in HA sidebar */
  show_in_sidebar?: boolean

  /** Language code for translations */
  language?: string

  /** Areas to pin at the top of the dashboard (in order) */
  pinned_areas?: string[]

  /** Areas to exclude from the dashboard */
  excluded_areas?: string[]

  /** Scene suffix for default tap action */
  default_scene_suffix?: string

  /** Per-area dashboard configuration */
  areas?: Record<string, DashboardAreaConfig>
}
