// @ts-check
// ============================================================================
// IKEA E2201 (RODRET) Blueprint - Double-Click Template
// ============================================================================
// Extends base with double-click: up=max brightness, down=min brightness
// ============================================================================

/**
 * Creates blueprint config for IKEA E2201 RODRET with double-click support
 * - Double-click up: max brightness (100%)
 * - Double-click down: min brightness (1%)
 * @param {string} lightEntityId - The light entity to control (e.g., 'light.mb_soc_bulb')
 * @param {object} [overrides] - Optional input overrides
 * @returns {object} Complete blueprint configuration object
 */
export function ikeaE2201DblClick(lightEntityId, overrides = {}) {
	return {
		path: 'EPMatt/ikea_e2201.yaml',
		input: {
			helper_long_press_delay: 100,
			button_up_long_max_loop_repeats: 50,
			button_down_long_max_loop_repeats: 50,

			// Enable virtual double-press detection
			button_up_double_press_exposed: true,
			button_down_double_press_exposed: true,

			action_button_up_short: [
				{ service: 'light.turn_on', target: { entity_id: lightEntityId } },
			],
			action_button_up_long: [
				{ service: 'light.turn_on', target: { entity_id: lightEntityId }, data: { brightness_step_pct: 2 } },
			],
			action_button_up_double: [
				{ service: 'light.turn_on', target: { entity_id: lightEntityId }, data: { brightness_pct: 100 } },
			],

			action_button_down_short: [
				{ service: 'light.turn_off', target: { entity_id: lightEntityId } },
			],
			action_button_down_long: [
				{ service: 'light.turn_on', target: { entity_id: lightEntityId }, data: { brightness_step_pct: -2 } },
			],
			action_button_down_double: [
				{ service: 'light.turn_on', target: { entity_id: lightEntityId }, data: { brightness_pct: 1 } },
			],

			...overrides,
		},
	}
}
