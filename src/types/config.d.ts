// Framework type definitions for generator config
// These types define the SHAPE of configs and are stable across installations
// Instance-specific types (AreaId, EntityId) stay in each installation's hass-config

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
   * Maps on/off actuators to their companion dimmable bulbs.
   * The actuator controls power, the bulb controls brightness.
   * Companion bulbs are auto-excluded from light groups and dashboard lists.
   * @example { 'switch.mb_soc': 'light.mb_soc_bulb' }
   */
  dimmable_companions?: Record<string, string>
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
