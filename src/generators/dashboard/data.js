// Shared data preparation for dashboard generation
// This module is template-agnostic - it prepares area data that any template can use

/**
 * Prepare area data for all areas based on inventory and config
 * @param {object} inventory - The HASS inventory data
 * @param {object} config - Dashboard config
 * @param {object} generatorConfig - Generator config (for dimmable_companions, etc.)
 * @param {object} [translator] - Optional translator for i18n
 * @returns {Array} Array of areaData objects
 */
export function prepareAllAreaData(inventory, config, generatorConfig = {}, translator = null) {
  const { areas, entities } = inventory
  const excludedAreas = new Set(config.excluded_areas || [])
  const pinnedAreas = config.pinned_areas || []

  const entityMap = buildEntityMap(entities)
  const allScenes = entities.filter(e => e.domain === 'scene')
  const sceneMap = buildSceneMapByArea(allScenes)

  const sortedAreas = sortAreas(areas, pinnedAreas, excludedAreas)
  const result = []

  for (const area of sortedAreas) {
    const prefix = extractPrefix(entities, area.id)

    if (!prefix) {
      console.log(`  ⚠ Skipping ${area.name}: no prefix detected`)
      continue
    }

    const areaConfig = config.areas?.[area.id] || {}
    const generatorAreaConfig = generatorConfig.areas?.[area.id] || {}
    const areaData = buildAreaData(area, prefix, entityMap, sceneMap, areaConfig, generatorAreaConfig, allScenes)

    if (!areaData.lightGroup) {
      console.log(`  ⚠ Skipping ${area.name}: no light group`)
      continue
    }

    result.push({
      area,
      prefix,
      areaConfig,
      visibleToUsers: areaConfig.visible_to_users || null,
      ...areaData,
    })
  }

  return result
}

function buildEntityMap(entities) {
  const map = new Map()

  for (const entity of entities) {
    if (!entity.area_id) continue

    if (!map.has(entity.area_id)) {
      map.set(entity.area_id, [])
    }

    map.get(entity.area_id).push(entity)
  }

  return map
}

function buildSceneMapByArea(scenes) {
  const map = new Map()

  for (const scene of scenes) {
    const areaId = scene.area_id
    if (!areaId) continue

    if (!map.has(areaId)) {
      map.set(areaId, [])
    }

    map.get(areaId).push(scene)
  }

  return map
}

function sortAreas(areas, pinnedAreas, excludedAreas) {
  const included = areas.filter(a => !excludedAreas.has(a.id))
  const pinnedSet = new Set(pinnedAreas)

  const pinned = []
  const unpinned = []

  for (const area of included) {
    if (pinnedSet.has(area.id)) {
      pinned.push(area)
    } else {
      unpinned.push(area)
    }
  }

  pinned.sort((a, b) => pinnedAreas.indexOf(a.id) - pinnedAreas.indexOf(b.id))
  unpinned.sort((a, b) => a.name.localeCompare(b.name))

  return [...pinned, ...unpinned]
}

export function extractPrefix(entities, areaId) {
  const areaEntities = entities.filter(e => e.area_id === areaId)

  for (const entity of areaEntities) {
    const name = entity.entity_id.split('.')[1]
    const underscoreIndex = name?.indexOf('_')

    if (underscoreIndex > 0) {
      return name.substring(0, underscoreIndex + 1)
    }
  }

  return null
}

function buildAreaData(area, prefix, entityMap, sceneMap, areaConfig, generatorAreaConfig, allScenes) {
  const areaEntities = entityMap.get(area.id) || []
  const areaScenes = sceneMap.get(area.id) || []

  const excludedLights = new Set(areaConfig.excluded_lights || [])
  const includedLights = areaConfig.included_lights || []
  const dimmableCompanions = generatorAreaConfig.dimmable_companions || {}

  const lightGroup = `group.${prefix}lights`
  const acEntity = findAcEntity(areaEntities)
  const fanEntity = findFanEntity(areaEntities)
  const lights = buildLightsList(areaEntities, excludedLights, includedLights, dimmableCompanions)
  const otherEntities = buildOtherList(areaEntities, excludedLights, lights, acEntity, fanEntity, dimmableCompanions)
  const scenes = buildScenesList(areaScenes, areaConfig, allScenes)

  return {
    lightGroup,
    acEntity,
    fanEntity,
    scenes,
    lights,
    otherEntities,
  }
}

function findAcEntity(entities) {
  const ac = entities.find(e =>
    e.domain === 'climate' && e.entity_id.endsWith('_ac')
  )

  return ac?.entity_id || null
}

function findFanEntity(entities) {
  const fan = entities.find(e => e.domain === 'fan')

  if (fan) return fan.entity_id

  const fanSwitch = entities.find(e =>
    e.domain === 'switch' && (
      e.entity_id.toLowerCase().includes('fan') ||
      e.name?.toLowerCase().includes('fan')
    )
  )

  return fanSwitch?.entity_id || null
}

function buildLightsList(entities, excludedLights, includedLights, dimmableCompanions) {
  const includedSet = new Set(includedLights)

  // Companion bulbs are controlled via their actuator - exclude from list
  const companionBulbs = new Set(Object.values(dimmableCompanions))

  const result = []

  for (const entityId of includedLights) {
    if (companionBulbs.has(entityId)) continue

    const entity = entities.find(e => e.entity_id === entityId)

    if (entity) {
      result.push(enrichWithDimming(entity, dimmableCompanions))
    } else {
      result.push({ entity_id: entityId, name: null, dimmable: false, brightness_entity: entityId, toggle_entity: entityId, has_advanced_controls: false })
    }
  }

  const areaLights = entities.filter(e =>
    e.domain === 'light' &&
    !excludedLights.has(e.entity_id) &&
    !includedSet.has(e.entity_id) &&
    !companionBulbs.has(e.entity_id)
  )

  result.push(...areaLights.map(e => enrichWithDimming(e, dimmableCompanions)))

  return result
}

function enrichWithDimming(entity, dimmableCompanions) {
  const modes = entity.attributes?.supported_color_modes || []
  const isOnOffOnly = modes.length === 0 || (modes.length === 1 && modes[0] === 'onoff')

  // Check if this actuator has a companion bulb for brightness control
  const companionBulb = dimmableCompanions[entity.entity_id]

  // Color modes that need more-info dialog for full control
  const colorModes = ['color_temp', 'hs', 'xy', 'rgb', 'rgbw', 'rgbww']
  const hasAdvancedControls = modes.some(m => colorModes.includes(m))

  return {
    ...entity,
    dimmable: !isOnOffOnly || !!companionBulb,
    brightness_entity: companionBulb || entity.entity_id,
    toggle_entity: entity.entity_id,
    has_advanced_controls: hasAdvancedControls,
  }
}

function buildOtherList(entities, excludedLights, lightsInSection, acEntity, fanEntity, dimmableCompanions = {}) {
  const lightIds = new Set(lightsInSection.map(l => l.entity_id))

  // Companion bulbs are controlled via their actuator - exclude from Other section too
  const companionBulbs = new Set(Object.values(dimmableCompanions))

  // Actuators that have companions shouldn't appear in Other (they're in Lights)
  const actuatorsWithCompanions = new Set(Object.keys(dimmableCompanions))

  return entities.filter(e => {
    if (excludedLights.has(e.entity_id)) return true
    if (lightIds.has(e.entity_id)) return false
    if (companionBulbs.has(e.entity_id)) return false
    if (actuatorsWithCompanions.has(e.entity_id)) return false
    if (e.entity_id === acEntity || e.entity_id === fanEntity) return false

    const excludeDomains = [
      'scene', 'sensor', 'binary_sensor', 'automation', 'script',
      'climate', 'fan', 'group', 'update', 'button', 'event',
      'number', 'select', 'camera', 'device_tracker', 'person',
      'remote', 'image', 'todo', 'tts', 'stt', 'conversation',
      'siren', 'time', 'date', 'datetime',
    ]

    if (excludeDomains.includes(e.domain)) return false

    return true
  })
}

function buildScenesList(areaScenes, areaConfig, allScenes) {
  const excludedScenes = new Set(areaConfig.excluded_scenes || [])
  const includedScenes = areaConfig.included_scenes || []

  // Filter out template scenes (name ends with _template) and excluded scenes
  const isTemplateScene = s => s.name?.endsWith('_template') || s.entity_id?.endsWith('_template')
  const filtered = areaScenes.filter(s => !excludedScenes.has(s.entity_id) && !isTemplateScene(s))

  const includedSet = new Set(filtered.map(s => s.entity_id))

  for (const sceneId of includedScenes) {
    if (includedSet.has(sceneId)) continue

    const scene = allScenes.find(s => s.entity_id === sceneId)

    if (scene && !isTemplateScene(scene)) {
      filtered.push(scene)
    } else if (!scene) {
      filtered.push({ entity_id: sceneId, name: null })
    }
  }

  return filtered
}

