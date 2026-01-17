// Sample generator configuration for testing
// Tests various config options from CONFIG_OPTIONS.md

export default {
	schemaVersion: 1,
	default_vacancy_duration: '00:10:00',
	excluded_labels: ['outdoor'],

	areas: {
		living_room: {
			include_in_group: ['switch.lr_soc_e'],
			exclude_from_group: ['light.lr_accent'],
		},

		bedroom: {
			vacancy_timer_duration: '00:05:00',
			syncedEntities: {
				mb_standing_lamp: {
					name: 'Master Bedroom Standing Lamp',
					power: null,
					entities: [
						{ entity_id: 'switch.mb_soc', sync: true },
						{ entity_id: 'light.mb_soc_bulb', sync: true, controls: 'dimmable' },
					],
				},
			},
		},

		front_yard: {
			// Override global exclusion - include outdoor lights for this area
			included_labels: ['outdoor'],
		},
	},
}
