// @ts-check
// ============================================================================
// IKEA E2213 (SOMRIG) Blueprint - Double-Click Template
// ============================================================================
// Extends base with double-click: dots1=max brightness, dots2=min brightness
// The E2213 natively supports double press (no virtual detection needed)
// ============================================================================

/**
 * Creates blueprint config for IKEA E2213 SOMRIG with double-click support
 * - Double-click dots1: max brightness (100%)
 * - Double-click dots2: min brightness (1%)
 * @param {string} lightEntityId - The light entity to control (e.g., 'light.mb_soc_bulb')
 * @param {object} [overrides] - Optional input overrides
 * @returns {object} Complete blueprint configuration object
 */
export function ikeaE2213DblClick(lightEntityId, overrides = {}) {
	return {
		path: 'EPMatt/ikea_e2213.yaml',
		input: {
			helper_long_press_delay: 100,
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
			action_button_dots1_double: [
				{ service: 'light.turn_on', target: { entity_id: lightEntityId }, data: { brightness_pct: 100 } },
			],

			// Dots2 button (2 dots) - OFF actions
			action_button_dots2_short: [
				{ service: 'light.turn_off', target: { entity_id: lightEntityId } },
			],
			action_button_dots2_long: [
				{ service: 'light.turn_on', target: { entity_id: lightEntityId }, data: { brightness_step_pct: -2 } },
			],
			action_button_dots2_double: [
				{ service: 'light.turn_on', target: { entity_id: lightEntityId }, data: { brightness_pct: 1 } },
			],

			...overrides,
		},
	}
}
