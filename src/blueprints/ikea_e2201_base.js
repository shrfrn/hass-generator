// @ts-check
// ============================================================================
// IKEA E2201 (RODRET) Blueprint - Base Template
// ============================================================================
// Basic on/off + dimming for IKEA RODRET dimmer remotes with EPMatt blueprint
// ============================================================================

/**
 * Creates blueprint config for IKEA E2201 RODRET dimmer
 * @param {string} lightEntityId - The light entity to control (e.g., 'light.mb_soc_bulb')
 * @param {object} [overrides] - Optional input overrides (e.g., { helper_long_press_delay: 150 })
 * @returns {object} Complete blueprint configuration object
 */
export function ikeaE2201Base(lightEntityId, overrides = {}) {
	return {
		path: 'EPMatt/ikea_e2201.yaml',
		input: {
			helper_long_press_delay: 100, // Default: 100ms (faster loop)
			button_up_long_max_loop_repeats: 50,
			button_down_long_max_loop_repeats: 50,

			action_button_up_short: [
				{ service: 'light.turn_on', target: { entity_id: lightEntityId } },
			],
			action_button_up_long: [
				{ service: 'light.turn_on', target: { entity_id: lightEntityId }, data: { brightness_step_pct: 2 } },
			],
			action_button_down_short: [
				{ service: 'light.turn_off', target: { entity_id: lightEntityId } },
			],
			action_button_down_long: [
				{ service: 'light.turn_on', target: { entity_id: lightEntityId }, data: { brightness_step_pct: -2 } },
			],

			...overrides,
		},
	}
}
