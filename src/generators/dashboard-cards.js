// Dashboard card builders for Bubble Card-based Lovelace dashboard

export function buildPreviewCard(area, prefix, areaData, defaultSceneSuffix) {
  const { lightGroup, acEntity, fanEntity, } = areaData
  const popupHash = `#${prefix}details`
  const defaultScene = `scene.${prefix}${defaultSceneSuffix}`

  const card = {
    type: 'custom:bubble-card',
    card_type: 'button',
    button_type: 'switch',
    entity: lightGroup,
    name: area.name,
    icon: area.icon || 'mdi:home',
    tap_action: {
      action: 'perform-action',
      perform_action: 'scene.turn_on',
      target: { entity_id: defaultScene, },
      data: {},
    },
    hold_action: { action: 'toggle', },
    button_action: {
      tap_action: {
        action: 'navigate',
        navigation_path: popupHash,
      },
    },
  }

  // Add sub-buttons for AC and fan if they exist
  const subButtons = []

  if (acEntity) {
    subButtons.push({
      entity: acEntity,
      icon: 'mdi:snowflake',
      tap_action: { action: 'toggle', },
    })
  }

  if (fanEntity) {
    subButtons.push({
      entity: fanEntity,
      tap_action: { action: 'toggle', },
    })
  }

  if (subButtons.length > 0) {
    card.sub_button = subButtons
  }

  return card
}

export function buildDetailsPopup(area, prefix, areaData, defaultSceneSuffix) {
  const { lightGroup, scenes, lights, acEntity, fanEntity, otherEntities, } = areaData
  const popupHash = `#${prefix}details`
  const defaultScene = `scene.${prefix}${defaultSceneSuffix}`

  const cards = []

  // Header popup card
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
      target: { entity_id: defaultScene, },
      data: {},
    },
    hold_action: { action: 'toggle', },
    button_action: {
      tap_action: { action: 'none', },
    },
  })

  // Scenes section
  if (scenes.length > 0) {
    cards.push(buildSeparator('Scenes'))
    cards.push(buildSceneGrid(scenes))
  }

  // Lights section
  if (lights.length > 0) {
    cards.push(buildSeparator('Lights'))
    cards.push(buildLightsGrid(lights))
  }

  // Climate section
  if (acEntity || fanEntity) {
    cards.push(buildSeparator('Climate'))
    cards.push(buildClimateCard(acEntity, fanEntity))
  }

  // Other section
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
    tap_action: { action: 'toggle', },
  }))

  return {
    type: 'grid',
    square: false,
    columns: 2,
    cards,
  }
}

function buildLightsGrid(lights) {
  const cards = lights.map(light => ({
    type: 'custom:bubble-card',
    card_type: 'button',
    button_type: 'switch',
    entity: light.entity_id,
    name: formatEntityName(light.entity_id, light.name),
    tap_action: { action: 'toggle', },
  }))

  return {
    type: 'grid',
    square: false,
    columns: 2,
    cards,
  }
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
    tap_action: { action: 'toggle', },
  }

  const subButtons = []

  if (fanEntity) {
    subButtons.push({
      entity: fanEntity,
      tap_action: { action: 'toggle', },
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
    tap_action: { action: 'toggle', },
  }))

  return {
    type: 'grid',
    square: false,
    columns: 2,
    cards,
  }
}

// Known scene suffixes with their display names
const SCENE_DISPLAY_NAMES = {
  standard: 'Standard',
  minimal: 'Minimal',
}

function formatEntityName(entityId, name) {
  const parts = entityId.split('.')
  const id = parts[1] || entityId

  // Check for known scene suffixes first (e.g., lr_standard -> Standard)
  // This applies even if name exists (since name is often just the entity_id suffix)
  if (parts[0] === 'scene') {
    for (const [suffix, displayName] of Object.entries(SCENE_DISPLAY_NAMES)) {
      if (id.endsWith(`_${suffix}`)) {
        return displayName
      }
    }
  }

  // Use custom name if it's different from entity_id suffix
  if (name && name !== id) return name

  // Remove prefix (e.g., lr_lt_wall_e -> wall_e)
  const withoutPrefix = id.replace(/^[a-z]+_/, '')

  // Convert underscores to spaces and capitalize
  return withoutPrefix
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

