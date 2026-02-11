// @ts-check
// Bubble Card template renderer
// Generates Lovelace dashboard using custom:bubble-card components

import { createTranslationHelpers, wrapWithUserCondition } from '../../shared.js'

/**
 * Render a complete dashboard from area data
 * @param {Array} areaDataList - Array of prepared area data
 * @param {object} config - Dashboard config
 * @param {object} [translator] - Optional translator with tEntity, tUi functions
 * @returns {object} Lovelace dashboard YAML structure
 */
export function render(areaDataList, config, translator = null) {
	const dashboardName = config.dashboard_name || 'Home'
	const defaultSceneSuffix = config.default_scene_suffix || 'standard'

	// Create helper functions that use translator if available
	const t = createTranslationHelpers(translator)

	const previewCards = [
		{ type: 'heading', heading: t.ui('heading.areas') },
	]
	const popupCards = []

	for (const areaData of areaDataList) {
		const previewCard = buildPreviewCard({ areaData, defaultSceneSuffix, t })
		previewCards.push(wrapWithUserCondition(previewCard, areaData.visibleToUsers))

		const detailsPopup = buildDetailsPopup({ areaData, defaultSceneSuffix, t })
		popupCards.push(wrapWithUserCondition(detailsPopup, areaData.visibleToUsers))

		const userNote = areaData.visibleToUsers ? ` (${areaData.visibleToUsers.length} users)` : ''
		console.log(`  ✓ ${areaData.area.name}${userNote}`)
	}

	const cards = [...previewCards, ...popupCards]

	return {
		views: [
			{
				title: dashboardName,
				sections: [
					{
						type: 'grid',
						cards,
					},
				],
			},
		],
	}
}

function buildPreviewCard({ areaData, defaultSceneSuffix, t }) {
	const { area, prefix, lightGroup, acEntity, fanEntity } = areaData
	const popupHash = `#${prefix}details`
	const defaultScene = `scene.${prefix}${defaultSceneSuffix}`

	const card = {
		type: 'custom:bubble-card',
		card_type: 'button',
		button_type: 'switch',
		entity: lightGroup,
		name: t.area(area.id, area.name),
		icon: area.icon || 'mdi:home',
		scrolling_effect: true,
		tap_action: {
			action: 'perform-action',
			perform_action: 'scene.turn_on',
			target: { entity_id: defaultScene },
			data: {},
		},
		hold_action: { action: 'toggle' },
		button_action: {
			tap_action: {
				action: 'navigate',
				navigation_path: popupHash,
			},
		},
	}

	const subButtons = []

	if (acEntity) {
		subButtons.push({
			entity: acEntity,
			icon: 'mdi:snowflake',
			tap_action: { action: 'toggle' },
		})
	}

	if (fanEntity) {
		subButtons.push({
			entity: fanEntity,
			tap_action: { action: 'toggle' },
		})
	}

	if (subButtons.length > 0) {
		card.sub_button = subButtons
		card.styles = `
      .bubble-sub-button-container {
        right: unset;
        inset-inline-end: 8px;
      }
    `
	}

	return card
}

function buildDetailsPopup({ areaData, defaultSceneSuffix, t }) {
	const { area, prefix, lightGroup, scenes, lights, acEntity, fanEntity, mediaPlayerEntity, otherEntities, areaConfig } = areaData
	const popupHash = `#${prefix}details`
	const defaultScene = `scene.${prefix}${defaultSceneSuffix}`

	const cards = []

	cards.push({
		type: 'custom:bubble-card',
		card_type: 'pop-up',
		hash: popupHash,
		button_type: 'switch',
		name: t.area(area.id, area.name),
		icon: area.icon || 'mdi:home',
		entity: lightGroup,
		tap_action: {
			action: 'perform-action',
			perform_action: 'scene.turn_on',
			target: { entity_id: defaultScene },
			data: {},
		},
		hold_action: { action: 'toggle' },
		button_action: {
			tap_action: { action: 'none' },
		},
	})

	const defaultSceneId = `scene.${prefix}${defaultSceneSuffix}`
	const filteredScenes = scenes.filter(s => s.entity_id !== defaultSceneId)

	if (filteredScenes.length > 0) {
		cards.push(buildSeparator(t.ui('section.scenes')))
		cards.push(buildSceneGrid(filteredScenes, t))
	}

	if (lights.length > 0) {
		cards.push(buildSeparator(t.ui('section.lights')))
		cards.push(buildLightsGrid(lights, t))
	}

	if (acEntity || fanEntity) {
		cards.push(buildSeparator(t.ui('section.climate')))
		cards.push(buildClimateCard(acEntity, fanEntity, t))
	}

	const mediaConfig = areaConfig?.media
	if (mediaPlayerEntity && mediaConfig?.remote_entity) {
		cards.push(buildSeparator(t.ui('section.media')))
		cards.push(buildMediaCard(mediaPlayerEntity, mediaConfig, prefix))
	}

	if (otherEntities.length > 0) {
		cards.push(buildSeparator(t.ui('section.other')))
		cards.push(buildOtherGrid(otherEntities, t))
	}

	return {
		type: 'vertical-stack',
		cards,
	}
}

function buildSeparator(name) {
	return {
		type: 'custom:bubble-card',
		card_type: 'separator',
		name,
	}
}

function buildSceneGrid(scenes, t) {
	const cards = scenes.map(scene => ({
		type: 'custom:bubble-card',
		card_type: 'button',
		button_type: 'switch',
		entity: scene.entity_id,
		name: t.entity(scene.entity_id, scene.name),
		scrolling_effect: true,
		tap_action: { action: 'toggle' },
	}))

	return {
		type: 'grid',
		square: false,
		columns: 2,
		cards,
	}
}

function buildLightsGrid(lights, t) {
	const cards = lights.map(light => buildLightCard(light, t))

	return {
		type: 'grid',
		square: false,
		columns: 2,
		cards,
	}
}

function buildLightCard(light, t) {
	const { dimmable, brightness_entity, toggle_entity, has_advanced_controls, is_synced_fixture } = light

	// For synced fixtures, use the fixture name directly without translation lookup
	const displayName = is_synced_fixture ? light.name : t.entity(light.entity_id, light.name)

	const card = {
		type: 'custom:bubble-card',
		card_type: 'button',
		button_type: dimmable ? 'slider' : 'switch',
		entity: brightness_entity,
		name: displayName,
		scrolling_effect: true,
	}
	if (light.icon) card.icon = light.icon

	// Build the toggle action (homeassistant.toggle works on any domain)
	const toggleAction = brightness_entity !== toggle_entity
		? {
			action: 'perform-action',
			perform_action: 'homeassistant.toggle',
			target: { entity_id: toggle_entity },
		}
		: { action: 'toggle' }

	if (dimmable) {
		// Slider: tap_action controls icon, button_action controls card area
		card.tap_action = toggleAction
		card.button_action = { tap_action: { action: 'none' } }

		// For sliders with advanced controls, use double_tap instead of hold
		// (hold conflicts with drag gesture on mobile)
		if (has_advanced_controls) {
			card.double_tap_action = { action: 'more-info' }
		}
	} else {
		// Switch: tap anywhere toggles
		card.tap_action = toggleAction

		// Hold opens more-info dialog for lights with color/color_temp controls
		if (has_advanced_controls) {
			card.hold_action = { action: 'more-info' }
		}
	}

	return card
}

function buildClimateCard(acEntity, fanEntity, t) {
	const card = {
		type: 'custom:bubble-card',
		card_type: 'climate',
		entity: acEntity,
		name: t.ui('climate.ac'),
		min_temp: 16,
		max_temp: 30,
		step: 1,
		tap_action: { action: 'toggle' },
	}

	const subButtons = []

	if (fanEntity) {
		subButtons.push({
			entity: fanEntity,
			tap_action: { action: 'toggle' },
		})
	}

	if (acEntity) {
		subButtons.push({
			entity: acEntity,
			icon: 'mdi:chevron-down',
			select_attribute: 'hvac_modes',
			show_arrow: false,
		})
	}

	if (subButtons.length > 0) {
		card.sub_button = subButtons
		card.styles = `
      .bubble-sub-button-container {
        right: unset;
        inset-inline-end: 8px;
      }
    `
	}

	return card
}

function buildOtherGrid(entities, t) {
	const cards = entities.map(entity => {
		// Excluded lights have dimmable info - render with slider if dimmable
		if (entity.dimmable !== undefined) {
			return {
				type: 'custom:bubble-card',
				card_type: 'button',
				button_type: entity.dimmable ? 'slider' : 'switch',
				entity: entity.brightness_entity,
				name: t.entity(entity.entity_id, entity.name),
				scrolling_effect: true,
				tap_action: {
					action: 'call-service',
					service: 'homeassistant.toggle',
					target: { entity_id: entity.toggle_entity },
				},
			}
		}

		// Non-light entities - simple toggle
		return {
			type: 'custom:bubble-card',
			card_type: 'button',
			button_type: 'switch',
			entity: entity.entity_id,
			name: t.entity(entity.entity_id, entity.name),
			scrolling_effect: true,
			tap_action: { action: 'toggle' },
		}
	})

	return {
		type: 'grid',
		square: false,
		columns: 2,
		cards,
	}
}

const DEFAULT_MEDIA_SOURCES = [
	{ name: 'Netflix', icon: 'mdi:netflix', source: 'Netflix' },
	{ name: 'YouTube', icon: 'mdi:youtube', source: 'YouTube' },
	{ name: 'Apple TV', icon: 'mdi:apple', source: 'TV' },
]

const PLATFORM_POPUP_HASH = {
	apple_tv: 'aptv_remote',
	android_tv: 'atv_remote',
}

const REMOTE_BOTTOM_BUTTONS_STYLES = `
	.bubble-sub-button-container,
	.bubble-sub-button-bottom-container {
		min-height: 72px;
		padding: 10px 0;
	}
	.bubble-sub-button {
		--bubble-sub-button-height: 64px;
		min-width: 64px;
		width: 64px;
		height: 64px;
		padding: 16px;
		border-radius: 50%;
		box-sizing: border-box;
	}
	.bubble-sub-button .show-icon,
	.bubble-sub-button .icon-without-state {
		--mdc-icon-size: 28px;
	}
`

const TOUCHPAD_CARD_STYLES = `
	ha-card {
		padding: 0;
		border: none;
		box-shadow: none;
	}
	#touchpad::part(toucharea) {
		background: var(--secondary-background-color);
		min-height: 250px;
		min-height: clamp(250px, 105vw, 400px);
		height: 250px;
		height: clamp(250px, 105vw, 400px);
	}
`

function buildMediaCard(mediaPlayerEntity, mediaConfig, prefix) {
	const { platform, remote_entity, sources = DEFAULT_MEDIA_SOURCES } = mediaConfig
	const popupHashSuffix = PLATFORM_POPUP_HASH[platform] || PLATFORM_POPUP_HASH.apple_tv
	const popupHash = `#${prefix}${popupHashSuffix}`
	const detailsHash = `#${prefix}details`

	const cards = []

	// Main button card with sub-buttons
	cards.push({
		type: 'custom:bubble-card',
		card_type: 'button',
		button_type: 'switch',
		entity: remote_entity,
		icon: 'mdi:remote-tv',
		button_action: {
			tap_action: {
				action: 'navigate',
				navigation_path: popupHash,
			},
		},
		tap_action: {
			action: 'navigate',
			navigation_path: popupHash,
		},
		sub_button: {
			main: [
				{
					icon: 'mdi:volume-high',
					name: 'Volume',
					entity: mediaPlayerEntity,
					tap_action: {
						action: 'perform-action',
						perform_action: 'media_player.volume_mute',
						target: {},
						data: { is_volume_muted: false },
					},
				},
				{
					icon: 'mdi:play-pause',
					force_icon: true,
					content_layout: 'icon-left',
					fill_width: false,
					name: 'Play / Pause',
					tap_action: {
						action: 'perform-action',
						perform_action: 'remote.send_command',
						target: { entity_id: remote_entity },
						data: { command: 'play_pause' },
					},
				},
				{
					entity: remote_entity,
					icon: 'mdi:power',
					force_icon: true,
					name: 'Power',
					tap_action: {
						action: 'perform-action',
						perform_action: 'remote.send_command',
						target: { entity_id: [remote_entity] },
						data: { command: 'wakeup' },
					},
					hold_action: {
						action: 'perform-action',
						perform_action: 'remote.send_command',
						target: { entity_id: remote_entity },
						data: { num_repeats: 1, delay_secs: 0.4, hold_secs: 0, command: 'suspend' },
					},
				},
			],
			bottom: [],
		},
	})

	// Popup card
	cards.push({
		type: 'custom:bubble-card',
		card_type: 'pop-up',
		hash: popupHash,
		button_type: 'name',
		show_header: false,
		card_layout: 'large',
		show_icon: true,
		sub_button: { main: [], bottom: [] },
	})

	// Sources sub-buttons
	const sourceButtons = sources.map(src => ({
		icon: src.icon,
		force_icon: true,
		content_layout: 'icon-left',
		fill_width: false,
		name: src.name,
		tap_action: {
			action: 'perform-action',
			perform_action: 'media_player.select_source',
			target: { entity_id: mediaPlayerEntity },
			data: { source: src.source },
		},
		hold_action: {
			action: 'perform-action',
			perform_action: 'remote.send_command',
			target: { entity_id: remote_entity },
			data: { command: 'home_hold' },
		},
	}))

	cards.push({
		type: 'custom:bubble-card',
		card_type: 'sub-buttons',
		rows: 0.938,
		hide_main_background: true,
		sub_button: {
			main: [],
			bottom: [
				{
					name: 'Sources',
					buttons_layout: 'inline',
					justify_content: 'space-between',
					group: sourceButtons,
				},
				{
					name: 'Exit',
					buttons_layout: 'inline',
					group: [
						{
							icon: 'mdi:close',
							force_icon: true,
							content_layout: 'icon-left',
							fill_width: false,
							name: 'Close',
							tap_action: {
								action: 'navigate',
								navigation_path: detailsHash,
							},
							hold_action: {
								action: 'perform-action',
								perform_action: 'remote.send_command',
								target: { entity_id: remote_entity },
								data: { command: 'suspend' },
							},
						},
					],
				},
			],
		},
	})

	// Touchpad - universal remote card
	cards.push({
		type: 'custom:universal-remote-card',
		rows: [['touchpad']],
		platform: 'Apple TV',
		custom_actions: [],
		remote_id: remote_entity,
		media_player_id: mediaPlayerEntity,
		autofill_entity_id: true,
		styles: TOUCHPAD_CARD_STYLES,
	})

	// Skip buttons
	cards.push({
		type: 'custom:bubble-card',
		card_type: 'sub-buttons',
		rows: 0.938,
		hide_main_background: true,
		styles: REMOTE_BOTTOM_BUTTONS_STYLES,
		sub_button: {
			main: [],
			bottom: [
				{
					name: 'Skip',
					buttons_layout: 'inline',
					justify_content: 'space-around',
					group: [
						{
							icon: 'mdi:rewind-10',
							force_icon: true,
							content_layout: 'icon-left',
							fill_width: false,
							name: 'Back 10 Secs.',
							tap_action: {
								action: 'perform-action',
								perform_action: 'remote.send_command',
								target: { entity_id: remote_entity },
								data: { command: 'skip_backward' },
							},
						},
						{
							icon: 'mdi:fast-forward-10',
							force_icon: true,
							content_layout: 'icon-left',
							fill_width: false,
							name: 'Forward 10 Secs.',
							tap_action: {
								action: 'perform-action',
								perform_action: 'remote.send_command',
								target: { entity_id: remote_entity },
								data: { command: 'skip_forward' },
							},
						},
					],
				},
			],
		},
	})

	// Navigation buttons
	cards.push({
		type: 'custom:bubble-card',
		card_type: 'sub-buttons',
		rows: 0.938,
		hide_main_background: true,
		footer_mode: true,
		footer_full_width: true,
		footer_bottom_offset: '30',
		styles: REMOTE_BOTTOM_BUTTONS_STYLES,
		sub_button: {
			main: [],
			bottom: [
				{
					name: 'Automatically grouped',
					buttons_layout: 'inline',
					group: [],
				},
				{
					name: 'Nav',
					buttons_layout: 'inline',
					justify_content: 'space-around',
					group: [
						{
							icon: 'mdi:play-pause',
							force_icon: true,
							content_layout: 'icon-left',
							fill_width: false,
							name: 'Play / Pause',
							tap_action: {
								action: 'perform-action',
								perform_action: 'remote.send_command',
								target: { entity_id: remote_entity },
								data: { command: 'play_pause' },
							},
						},
						{
							icon: 'mdi:chevron-left',
							force_icon: true,
							content_layout: 'icon-left',
							fill_width: false,
							name: 'Back',
							tap_action: {
								action: 'perform-action',
								perform_action: 'remote.send_command',
								target: { entity_id: remote_entity },
								data: { command: 'menu' },
							},
						},
						{
							icon: 'mdi:television',
							force_icon: true,
							content_layout: 'icon-left',
							fill_width: false,
							name: 'Home',
							tap_action: {
								action: 'perform-action',
								perform_action: 'remote.send_command',
								target: { entity_id: remote_entity },
								data: { command: 'home' },
							},
							hold_action: {
								action: 'perform-action',
								perform_action: 'remote.send_command',
								target: { entity_id: remote_entity },
								data: { command: 'home_hold' },
							},
						},
					],
				},
			],
		},
	})

	return {
		type: 'vertical-stack',
		cards,
	}
}
