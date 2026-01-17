// @ts-check
// ============================================================================
// YAML GENERATOR CONFIG
// ============================================================================
// Purpose: Configures the YAML package generator (hass-gen generate)
// Outputs: packages/areas/*.yaml (light groups, helpers, timers, etc.)
//
// This file is never overwritten by the generator.
// ============================================================================

/** @type {import('./inventory/types/config').GeneratorConfig} */
const config = {
	// Schema version - do not change manually
	schemaVersion: 1,

	// ─────────────────────────────────────────────────────────────────────────
	// GLOBAL OPTIONS
	// ─────────────────────────────────────────────────────────────────────────

	// Default vacancy timer duration (when area becomes empty)
	default_vacancy_duration: '00:09:00',

	// Labels to exclude from ALL light groups by default
	// Entities with these labels won't be added to area light groups
	excluded_labels: [],

	// ─────────────────────────────────────────────────────────────────────────
	// PER-AREA OVERRIDES
	// ─────────────────────────────────────────────────────────────────────────
	// Browse inventory/entities.js to find entity IDs and labels
	//
	// Example - all options:
	//   kitchen: {
	//     vacancy_timer_duration: '00:05:00',      // Override vacancy timer
	//     include_in_group: ['switch.kt_cabinet'], // Add entities to light group
	//     exclude_from_group: ['light.kt_notif'],  // Remove from light group
	//     excluded_labels: [],                     // Clear global exclusions for this area
	//     included_labels: ['outdoor'],            // Include outdoor lights in this area
	//
	//     // Synced entity fixtures - generates sync automations, template lights, and groups
	//     // Controls shorthand: 'dimmable', 'tunable', 'rgb', or explicit array
	//     // Note: Configure Z2M power-on brightness to prevent dim starts
	//     syncedEntities: {
	//       kt_wall_light: {
	//         name: 'Kitchen Wall Light',
	//         power: 'light.kt_lt_wall',  // null = always on, entity_id = generates template
	//         entities: [
	//           { entity_id: 'light.kt_lt_wall', sync: true },  // Power relay
	//           { entity_id: 'light.kt_hue_bulb', sync: true, controls: 'dimmable' },
	//         ],
	//       },
	//     },
	//   },

	areas: {
		// Add your area overrides here
	},
}

export default config

