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
	const { area, prefix, lightGroup, scenes, lights, acEntity, fanEntity, otherEntities } = areaData
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

