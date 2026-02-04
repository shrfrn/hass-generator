// Sample dashboard configuration for testing
// Tests various dashboard options from CONFIG_OPTIONS.md

export default {
	schemaVersion: 1,
	template: 'bubble',
	output: 'lovelace/test.yaml',
	dashboard_name: 'Test',
	dashboard_path: 'test',
	dashboard_title: 'Test Dashboard',
	dashboard_icon: 'mdi:view-dashboard',

	pinned_areas: ['living_room', 'bedroom'],
	excluded_areas: ['empty_area'],
	default_scene_suffix: 'standard',

	areas: {
		living_room: {
			excluded_lights: ['light.lr_outdoor'],
			included_lights: ['switch.lr_soc_e'],
			excluded_scenes: ['scene.lr_movie_mode'],
			media: {
				platform: 'apple_tv',
				remote_entity: 'remote.lr_apple_tv',
			},
		},

		kitchen: {
			// Cross-area scene inclusion
			included_scenes: ['scene.lr_movie_mode'],
		},

		bedroom: {
			visible_to_users: ['user_parent_1', 'user_parent_2'],
		},
	},
}
