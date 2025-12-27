// Shared data preparation for dashboard generation
// This module is template-agnostic - it prepares area data that any template can use

/**
 * Prepare area data for all areas based on inventory and config
 * @param {object} inventory - The HASS inventory data
 * @param {object} config - Dashboard config
 * @returns {Array} Array of areaData objects
 */
export function prepareAllAreaData(inventory, config) {
  const { areas, entities, scenes } = inventory
  const excludedAreas = new Set(config.excluded_areas || [])
  const pinnedAreas = config.pinned_areas || []

  const entityMap = buildEntityMap(entities)
  const sceneMap = buildSceneMap(scenes)

  const sortedAreas = sortAreas(areas, pinnedAreas, excludedAreas)
  const result = []

  for (const area of sortedAreas) {
    const prefix = extractPrefix(entities, area.id)

    if (!prefix) {
      console.log(`  ⚠ Skipping ${area.name}: no prefix detected`)
      continue
    }

    const areaConfig = config.areas?.[area.id] || {}
    const areaData = buildAreaData(area, prefix, entityMap, sceneMap, areaConfig)

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

function buildSceneMap(scenes) {
  const map = new Map()

  for (const scene of scenes) {
    const parts = scene.entity_id.split('.')
    const name = parts[1] || ''
    const underscoreIdx = name.indexOf('_')

    if (underscoreIdx > 0) {
      const prefix = name.substring(0, underscoreIdx + 1)

      if (!map.has(prefix)) {
        map.set(prefix, [])
      }

      map.get(prefix).push(scene)
    }
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

function buildAreaData(area, prefix, entityMap, sceneMap, areaConfig) {
  const areaEntities = entityMap.get(area.id) || []
  const areaScenes = sceneMap.get(prefix) || []

  const excludedLights = new Set(areaConfig.excluded_lights || [])
  const includedLights = areaConfig.included_lights || []

  const lightGroup = `group.${prefix}lights`
  const acEntity = findAcEntity(areaEntities)
  const fanEntity = findFanEntity(areaEntities)
  const lights = buildLightsList(areaEntities, excludedLights, includedLights)
  const otherEntities = buildOtherList(areaEntities, excludedLights, lights, acEntity, fanEntity)

  return {
    lightGroup,
    acEntity,
    fanEntity,
    scenes: areaScenes,
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

function buildLightsList(entities, excludedLights, includedLights) {
  const includedSet = new Set(includedLights)
  const result = []

  for (const entityId of includedLights) {
    const entity = entities.find(e => e.entity_id === entityId)

    if (entity) {
      result.push(entity)
    } else {
      result.push({ entity_id: entityId, name: null })
    }
  }

  const areaLights = entities.filter(e =>
    e.domain === 'light' &&
    !excludedLights.has(e.entity_id) &&
    !includedSet.has(e.entity_id)
  )

  result.push(...areaLights)

  return result
}

function buildOtherList(entities, excludedLights, lightsInSection, acEntity, fanEntity) {
  const lightIds = new Set(lightsInSection.map(l => l.entity_id))

  return entities.filter(e => {
    if (excludedLights.has(e.entity_id)) return true
    if (lightIds.has(e.entity_id)) return false
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

