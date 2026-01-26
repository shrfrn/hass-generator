// @ts-check
// ============================================================================
// IKEA E2213 (SOMRIG) Blueprint - Base Template
// ============================================================================
// Basic on/off + dimming for IKEA SOMRIG shortcut button with EPMatt blueprint
// dots1 = on/brightness up, dots2 = off/brightness down
// ============================================================================

/**
 * Creates blueprint config for IKEA E2213 SOMRIG shortcut button
 * @param {string} lightEntityId - The light entity to control (e.g., 'light.mb_soc_bulb')
 * @param {object} [overrides] - Optional input overrides (e.g., { helper_long_press_delay: 150 })
 * @returns {object} Complete blueprint configuration object
 */
export function ikeaE2213Base(lightEntityId, overrides = {}) {
	return {
		path: 'EPMatt/ikea_e2213.yaml',
		input: {
			helper_long_press_delay: 100, // Default: 100ms (faster loop)
			button_dots1_long_loop: true,
			button_dots1_long_max_loop_repeats: 50,
			button_dots2_long_loop: true,
			button_dots2_long_max_loop_repeats: 50,

			// Dots1 button (1 dot) - ON actions
			action_button_dots1_short: [
				{ service: 'light.turn_on', target: { entity_id: lightEntityId } },
			],
			action_button_dots1_long: [
				{ service: 'light.turn_on', target: { entity_id: lightEntityId }, data: { brightness_step_pct: 2 } },
			],

			// Dots2 button (2 dots) - OFF actions
			action_button_dots2_short: [
				{ service: 'light.turn_off', target: { entity_id: lightEntityId } },
			],
			action_button_dots2_long: [
				{ service: 'light.turn_on', target: { entity_id: lightEntityId }, data: { brightness_step_pct: -2 } },
			],

			...overrides,
		},
	}
}
