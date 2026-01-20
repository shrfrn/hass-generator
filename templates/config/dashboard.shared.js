// @ts-check
// ============================================================================
// GLOBAL DASHBOARD CONFIG
// ============================================================================
// Shared settings for all dashboards. Specific dashboards import and extend
// this config with template-specific options.
//
// This file is never overwritten by the generator.
// ============================================================================

// import { PARENTS } from '../users.js'

/** @type {import('../inventory/types/config.js').GlobalDashboardConfig} */
const config = {
	schemaVersion: 1,

	// Language for translations (from i18n/*.csv)
	language: 'en',

	// Areas to pin at the top of the dashboard (in order)
	// Run 'npx hass-gen inventory' first, then browse inventory/areas.json for area IDs
	pinned_areas: [
		// 'living_room',
		// 'kitchen',
		// 'bedroom',
	],

	// Areas to exclude from the dashboard
	excluded_areas: ['home_assistant', 'home'],

	// Scene suffix for default tap action (scene.<prefix><suffix>)
	default_scene_suffix: 'standard',

	// Per-area dashboard configuration
	// Browse inventory/entities.json to find entity IDs
	areas: {
		// Example area configuration:
		// living_room: {
		//   excluded_lights: ['light.lr_lt_outdoor_projector'],
		//   included_lights: ['switch.lr_soc_e'],
		//   included_scenes: ['scene.lr_twilight_zone'],
		//   visible_to_users: PARENTS,
		// },
	},
}

export default config
