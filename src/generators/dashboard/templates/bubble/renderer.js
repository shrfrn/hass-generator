// Bubble Card template renderer
// Generates Lovelace dashboard using custom:bubble-card components

/**
 * Render a complete dashboard from area data
 * @param {Array} areaDataList - Array of prepared area data
 * @param {object} config - Dashboard config
 * @returns {object} Lovelace dashboard YAML structure
 */
export function render(areaDataList, config) {
  const dashboardName = config.dashboard_name || 'Home'
  const defaultSceneSuffix = config.default_scene_suffix || 'standard'

  const previewCards = [
    { type: 'heading', heading: 'Areas' },
  ]
  const popupCards = []

  for (const areaData of areaDataList) {
    const { area, prefix, visibleToUsers } = areaData

    const previewCard = buildPreviewCard(area, prefix, areaData, defaultSceneSuffix)
    previewCards.push(wrapWithUserCondition(previewCard, visibleToUsers))

    const detailsPopup = buildDetailsPopup(area, prefix, areaData, defaultSceneSuffix)
    popupCards.push(wrapWithUserCondition(detailsPopup, visibleToUsers))

    const userNote = visibleToUsers ? ` (${visibleToUsers.length} users)` : ''
    console.log(`  ✓ ${area.name}${userNote}`)
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

function wrapWithUserCondition(card, visibleToUsers) {
  if (!visibleToUsers || visibleToUsers.length === 0) {
    return card
  }

  return {
    type: 'conditional',
    conditions: [
      {
        condition: 'user',
        users: visibleToUsers,
      },
    ],
    card,
  }
}

function buildPreviewCard(area, prefix, areaData, defaultSceneSuffix) {
  const { lightGroup, acEntity, fanEntity } = areaData
  const popupHash = `#${prefix}details`
  const defaultScene = `scene.${prefix}${defaultSceneSuffix}`

  const card = {
    type: 'custom:bubble-card',
    card_type: 'button',
    button_type: 'switch',
    entity: lightGroup,
    name: area.name,
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

function buildDetailsPopup(area, prefix, areaData, defaultSceneSuffix) {
  const { lightGroup, scenes, lights, acEntity, fanEntity, otherEntities } = areaData
  const popupHash = `#${prefix}details`
  const defaultScene = `scene.${prefix}${defaultSceneSuffix}`

  const cards = []

  cards.push({
    type: 'custom:bubble-card',
    card_type: 'pop-up',
    hash: popupHash,
    button_type: 'switch',
    name: area.name,
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
    cards.push(buildSeparator('Scenes'))
    cards.push(buildSceneGrid(filteredScenes))
  }

  if (lights.length > 0) {
    cards.push(buildSeparator('Lights'))
    cards.push(buildLightsGrid(lights))
  }

  if (acEntity || fanEntity) {
    cards.push(buildSeparator('Climate'))
    cards.push(buildClimateCard(acEntity, fanEntity))
  }

  if (otherEntities.length > 0) {
    cards.push(buildSeparator('Other'))
    cards.push(buildOtherGrid(otherEntities))
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

function buildSceneGrid(scenes) {
  const cards = scenes.map(scene => ({
    type: 'custom:bubble-card',
    card_type: 'button',
    button_type: 'switch',
    entity: scene.entity_id,
    name: formatEntityName(scene.entity_id, scene.name),
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

function buildLightsGrid(lights) {
  const cards = lights.map(light => buildLightCard(light))

  return {
    type: 'grid',
    square: false,
    columns: 2,
    cards,
  }
}

function buildLightCard(light) {
  const { dimmable, brightness_entity, toggle_entity, has_advanced_controls } = light

  const card = {
    type: 'custom:bubble-card',
    card_type: 'button',
    button_type: dimmable ? 'slider' : 'switch',
    entity: brightness_entity,
    name: formatEntityName(light.entity_id, light.name),
    scrolling_effect: true,
  }

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

function buildClimateCard(acEntity, fanEntity) {
  const card = {
    type: 'custom:bubble-card',
    card_type: 'climate',
    entity: acEntity,
    name: 'AC',
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

function buildOtherGrid(entities) {
  const cards = entities.map(entity => ({
    type: 'custom:bubble-card',
    card_type: 'button',
    button_type: 'switch',
    entity: entity.entity_id,
    name: formatEntityName(entity.entity_id, entity.name),
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

const SCENE_DISPLAY_NAMES = {
  standard: 'Standard',
  minimal: 'Minimal',
}

function formatEntityName(entityId, name) {
  const parts = entityId.split('.')
  const id = parts[1] || entityId

  if (parts[0] === 'scene') {
    for (const [suffix, displayName] of Object.entries(SCENE_DISPLAY_NAMES)) {
      if (id.endsWith(`_${suffix}`)) {
        return displayName
      }
    }
  }

  if (name && name !== id) return name

  const withoutPrefix = id.replace(/^[a-z]+_/, '')

  return withoutPrefix
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

