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
	const { area, prefix, visibleToUsers, scenes, lights, acEntity, fanEntity, otherEntities, lightGroup } = areaData
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

	if (otherEntities.length > 0) {
		cards.push(buildSeparator(t.ui('section.other')))
		cards.push(buildOtherGrid(otherEntities, t))
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
	const { area, prefix, lightGroup, acEntity, fanEntity } = areaData
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

