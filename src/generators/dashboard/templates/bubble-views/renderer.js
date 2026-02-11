// @ts-check
// Bubble Card Views template renderer
// Generates multi-view Lovelace dashboard using HA built-in views instead of popups

import { createTranslationHelpers, wrapWithUserCondition } from '../../shared.js'

/**
 * Render a multi-view dashboard from area data
 * @param {Array} areaDataList - Array of prepared area data
 * @param {object} config - Dashboard config
 * @param {object} [translator] - Optional translator with tEntity, tUi functions
 * @returns {object} Lovelace dashboard YAML structure
 */
export function render(areaDataList, config, translator = null) {
	const dashboardName = config.dashboard_name || 'Home'
	const dashboardPath = config.dashboard_path || 'views'
	const defaultSceneSuffix = config.default_scene_suffix || 'standard'

	// Create helper functions that use translator if available
	const t = createTranslationHelpers(translator)

	const views = []

	const mainView = buildMainView(areaDataList, dashboardName, dashboardPath, defaultSceneSuffix, config, t)
	views.push(mainView)

	for (const areaData of areaDataList) {
		const { area, visibleToUsers } = areaData

		const areaView = buildAreaView(areaData, dashboardPath, defaultSceneSuffix, t)
		views.push(areaView)

		const userNote = visibleToUsers ? ` (${visibleToUsers.length} users)` : ''
		console.log(`  ✓ ${area.name}${userNote}`)
	}

	return { views }
}

function buildMainView(areaDataList, dashboardName, dashboardPath, defaultSceneSuffix, config, t) {
	const cards = []

	if (config.home_card) {
		cards.push(buildHomeCard(config.home_card))
	}

	if (config.presence_card) {
		cards.push(buildPresenceCard(config.presence_card))
	}

	cards.push({ type: 'heading', heading: t.ui('heading.areas') })

	for (const areaData of areaDataList) {
		const previewCard = buildPreviewCard({ areaData, dashboardPath, defaultSceneSuffix, t })
		cards.push(wrapWithUserCondition(previewCard, areaData.visibleToUsers))
	}

	return {
		title: dashboardName,
		path: 'home',
		sections: [
			{
				type: 'grid',
				cards,
			},
		],
	}
}

function buildHomeCard(homeCardConfig) {
	const subButtons = (homeCardConfig.sub_buttons || []).map(btn => {
		const subBtn = {
			entity: btn.entity,
		}

		if (btn.icon) subBtn.icon = btn.icon
		if (btn.name) subBtn.name = btn.name

		if (btn.action === 'hold') {
			subBtn.tap_action = { action: 'none' }
			subBtn.hold_action = { action: 'toggle' }
		} else {
			subBtn.tap_action = { action: 'toggle' }
		}

		return subBtn
	})

	return {
		type: 'custom:bubble-card',
		card_type: 'button',
		button_type: 'switch',
		entity: homeCardConfig.entity || 'sun.sun',
		name: ' ',
		icon: 'mdi:home-outline',
		card_layout: 'normal',
		rows: '2',
		tap_action: { action: 'none' },
		hold_action: { action: 'none' },
		button_action: { tap_action: { action: 'none' } },
		sub_button: subButtons,
		styles: `
      .bubble-sub-button-container {
        right: unset;
        inset-inline-end: 8px;
      }
    `,
	}
}

function buildPresenceCard(presenceCardConfig) {
	const subButtons = (presenceCardConfig.users || []).map(user => ({
		entity: user.entity,
		name: user.name,
		icon: user.icon || 'mdi:account',
		show_name: true,
		show_state: false,
		show_last_changed: false,
	}))

	return {
		type: 'custom:bubble-card',
		card_type: 'button',
		button_type: 'state',
		entity: presenceCardConfig.entity || 'binary_sensor.anyone_home',
		name: ' ',
		icon: 'mdi:account-multiple',
		show_name: true,
		show_icon: true,
		show_state: false,
		scrolling_effect: false,
		button_action: {},
		sub_button: subButtons,
		styles: `
      .bubble-sub-button-container {
        right: unset;
        inset-inline-end: 8px;
      }
    `,
	}
}

function buildAreaView(areaData, dashboardPath, defaultSceneSuffix, t) {
	const { area, prefix, visibleToUsers, scenes, lights, acEntity, fanEntity, mediaPlayerEntity, otherEntities, lightGroup, areaConfig } = areaData
	const areaPath = area.id.replace(/_/g, '-')
	const defaultScene = `scene.${prefix}${defaultSceneSuffix}`

	const cards = []

	cards.push(buildHeaderCard(area, lightGroup, dashboardPath, defaultScene, t))

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
	let mediaPopupStack = null
	if (mediaPlayerEntity && mediaConfig?.remote_entity) {
		const { buttonCard, popupStack } = buildMediaCard(mediaPlayerEntity, mediaConfig, prefix, dashboardPath, areaPath)
		cards.push(buildSeparator(t.ui('section.media')))
		cards.push(buttonCard)
		mediaPopupStack = popupStack
	}

	if (otherEntities.length > 0) {
		cards.push(buildSeparator(t.ui('section.other')))
		cards.push(buildOtherGrid(otherEntities, t))
	}

	// Popup must be at the END of the view's cards (after all sections)
	if (mediaPopupStack) {
		cards.push(mediaPopupStack)
	}

	const view = {
		icon: area.icon || 'mdi:home',
		path: areaPath,
		sections: [
			{
				type: 'grid',
				cards,
			},
		],
	}

	if (visibleToUsers && visibleToUsers.length > 0) {
		view.visible = visibleToUsers.map(userId => ({ user: userId }))
	}

	return view
}

function buildHeaderCard(area, lightGroup, dashboardPath, defaultScene, t) {
	return {
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
			tap_action: { action: 'none' },
		},
		sub_button: [
			{
				icon: 'mdi:home-outline',
				tap_action: {
					action: 'navigate',
					navigation_path: `/${dashboardPath}/home`,
				},
			},
		],
		styles: `
      .bubble-sub-button-container {
        right: unset;
        inset-inline-end: 8px;
      }
    `,
	}
}

function buildPreviewCard({ areaData, dashboardPath, defaultSceneSuffix, t }) {
	const { area, prefix, lightGroup, acEntity, fanEntity, mediaPlayerEntity, areaConfig } = areaData
	const areaPath = area.id.replace(/_/g, '-')
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
				navigation_path: `/${dashboardPath}/${areaPath}`,
			},
		},
	}

	const subButtons = []
	const mediaConfig = areaConfig?.media

	if (mediaPlayerEntity && mediaConfig?.remote_entity) {
		const platform = mediaConfig.platform
		const popupHashSuffix = PLATFORM_POPUP_HASH[platform] || PLATFORM_POPUP_HASH.apple_tv
		const popupHash = `#${prefix}${popupHashSuffix}`

		subButtons.push({
			icon: 'mdi:television',
			tap_action: { action: 'navigate', navigation_path: `/${dashboardPath}/${areaPath}${popupHash}` },
		})
	}

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

	const toggleAction = brightness_entity !== toggle_entity
		? {
			action: 'perform-action',
			perform_action: 'homeassistant.toggle',
			target: { entity_id: toggle_entity },
		}
		: { action: 'toggle' }

	if (dimmable) {
		card.tap_action = toggleAction
		card.button_action = { tap_action: { action: 'none' } }

		if (has_advanced_controls) {
			card.double_tap_action = { action: 'more-info' }
		}
	} else {
		card.tap_action = toggleAction

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

function buildMediaCard(mediaPlayerEntity, mediaConfig, prefix, dashboardPath, areaPath) {
	const { platform, remote_entity, sources = DEFAULT_MEDIA_SOURCES } = mediaConfig
	const popupHashSuffix = PLATFORM_POPUP_HASH[platform] || PLATFORM_POPUP_HASH.apple_tv
	const popupHash = `#${prefix}${popupHashSuffix}`

	const buttonCard = createMediaButtonCard(mediaPlayerEntity, remote_entity, popupHash)

	const popupCards = [
		createPopupHeader(popupHash, remote_entity),
		createSourcesCard(mediaPlayerEntity, remote_entity, sources, dashboardPath, areaPath),
		createTouchpadCard(mediaPlayerEntity, remote_entity),
		createSkipButtonsCard(remote_entity),
		createNavigationButtonsCard(remote_entity),
	]

	return {
		buttonCard,
		popupStack: { type: 'vertical-stack', cards: popupCards },
	}
}

function createMediaButtonCard(mediaPlayerEntity, remote_entity, popupHash) {
	const navAction = { action: 'navigate', navigation_path: popupHash }

	return {
		type: 'custom:bubble-card',
		card_type: 'button',
		button_type: 'switch',
		entity: mediaPlayerEntity,
		icon: 'mdi:remote-tv',
		button_action: { tap_action: navAction },
		tap_action: navAction,
		sub_button: {
			main: [
				createVolumeSubButton(mediaPlayerEntity),
				createPlayPauseSubButton(mediaPlayerEntity, remote_entity),
				createPowerSubButton(remote_entity, popupHash),
			],
			bottom: [],
		},
	}
}

const MEDIA_PLAYER_ACTIVE_STATES = ['playing', 'paused', 'idle', 'on', 'buffering']

function createVolumeSubButton(mediaPlayerEntity) {
	return {
		icon: 'mdi:volume-high',
		name: 'Volume',
		entity: mediaPlayerEntity,
		tap_action: { action: 'more-info', entity: mediaPlayerEntity },
		visibility: [{ condition: 'state', entity: mediaPlayerEntity, state: MEDIA_PLAYER_ACTIVE_STATES }],
	}
}

function createPlayPauseSubButton(mediaPlayerEntity, remote_entity) {
	return {
		icon: 'mdi:play-pause',
		force_icon: true,
		content_layout: 'icon-left',
		fill_width: false,
		name: 'Play / Pause',
		tap_action: createRemoteCommand(remote_entity, 'play_pause'),
		visibility: [{ condition: 'state', entity: mediaPlayerEntity, state: MEDIA_PLAYER_ACTIVE_STATES }],
	}
}

function createPowerSubButton(remote_entity, popupHash) {
	return {
		entity: remote_entity,
		icon: 'mdi:power',
		force_icon: true,
		name: 'Power',
		tap_action: { action: 'navigate', navigation_path: popupHash },
		hold_action: {
			action: 'perform-action',
			perform_action: 'remote.send_command',
			target: { entity_id: remote_entity },
			data: { num_repeats: 1, delay_secs: 0.4, hold_secs: 0, command: 'suspend' },
		},
	}
}

function createPopupHeader(popupHash, remote_entity) {
	return {
		type: 'custom:bubble-card',
		card_type: 'pop-up',
		hash: popupHash,
		button_type: 'name',
		show_header: false,
		card_layout: 'large',
		show_icon: true,
		sub_button: { main: [], bottom: [] },
		open_action: {
			action: 'perform-action',
			perform_action: 'remote.send_command',
			target: { entity_id: remote_entity },
			data: { command: 'wakeup' },
		},
	}
}

function createSourcesCard(mediaPlayerEntity, remote_entity, sources, dashboardPath, areaPath) {
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
		hold_action: createRemoteCommand(remote_entity, 'home_hold'),
	}))

	const closeButton = {
		icon: 'mdi:close',
		force_icon: true,
		content_layout: 'icon-left',
		fill_width: false,
		name: 'Close',
		tap_action: { action: 'navigate', navigation_path: `/${dashboardPath}/${areaPath}` },
		hold_action: createRemoteCommand(remote_entity, 'suspend'),
	}

	return {
		type: 'custom:bubble-card',
		card_type: 'sub-buttons',
		rows: 0.938,
		hide_main_background: true,
		sub_button: {
			main: [],
			bottom: [
				{ name: 'Sources', buttons_layout: 'inline', justify_content: 'space-between', group: sourceButtons },
				{ name: 'Exit', buttons_layout: 'inline', group: [closeButton] },
			],
		},
	}
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
		min-height: clamp(250px, 100vw, 400px);
		height: 250px;
		height: clamp(250px, 100vw, 400px);
	}
`

function createTouchpadCard(mediaPlayerEntity, remote_entity) {
	return {
		type: 'custom:universal-remote-card',
		rows: [['touchpad']],
		platform: 'Apple TV',
		custom_actions: [],
		remote_id: remote_entity,
		media_player_id: mediaPlayerEntity,
		autofill_entity_id: true,
		styles: TOUCHPAD_CARD_STYLES,
	}
}

function createSkipButtonsCard(remote_entity) {
	return {
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
						createIconButton('mdi:rewind-10', 'Back 10 Secs.', createRemoteCommand(remote_entity, 'skip_backward')),
						createIconButton('mdi:fast-forward-10', 'Forward 10 Secs.', createRemoteCommand(remote_entity, 'skip_forward')),
					],
				},
			],
		},
	}
}

function createNavigationButtonsCard(remote_entity) {
	const playPauseBtn = createIconButton('mdi:play-pause', 'Play / Pause', createRemoteCommand(remote_entity, 'play_pause'))
	const backBtn = createIconButton('mdi:chevron-left', 'Back', createRemoteCommand(remote_entity, 'menu'))

	const homeBtn = {
		...createIconButton('mdi:television', 'Home', createRemoteCommand(remote_entity, 'home')),
		hold_action: createRemoteCommand(remote_entity, 'home_hold'),
	}

	return {
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
				{ name: 'Automatically grouped', buttons_layout: 'inline', group: [] },
				{ name: 'Nav', buttons_layout: 'inline', justify_content: 'space-around', group: [playPauseBtn, backBtn, homeBtn] },
			],
		},
	}
}

function createRemoteCommand(remote_entity, command) {
	return {
		action: 'perform-action',
		perform_action: 'remote.send_command',
		target: { entity_id: remote_entity },
		data: { command },
	}
}

function createIconButton(icon, name, tap_action) {
	return { icon, force_icon: true, content_layout: 'icon-left', fill_width: false, name, tap_action }
}
