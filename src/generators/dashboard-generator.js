import { buildPreviewCard, buildDetailsPopup } from './dashboard-cards.js'

export function generateDashboard(inventory, config) {
  const { areas, entities, scenes, } = inventory
  const dashboardName = config.dashboard_name || 'Home'
  const excludedAreas = new Set(config.excluded_areas || [])
  const pinnedAreas = config.pinned_areas || []
  const defaultSceneSuffix = config.default_scene_suffix || 'standard'

  const previewCards = [
    { type: 'heading', heading: 'Areas', },
  ]
  const popupCards = []

  // Build area data map for quick lookup
  const entityMap = buildEntityMap(entities)
  const sceneMap = buildSceneMap(scenes)

  // Sort areas: pinned first (in order), then rest alphabetically by name
  const sortedAreas = sortAreas(areas, pinnedAreas, excludedAreas)

  for (const area of sortedAreas) {

    const prefix = extractPrefix(entities, area.id)

    if (!prefix) {
      console.log(`  ⚠ Skipping ${area.name}: no prefix detected`)
      continue
    }

    const areaConfig = config.areas?.[area.id] || {}
    const areaData = buildAreaData(area, prefix, entityMap, sceneMap, areaConfig)

    // Skip areas with no light group
    if (!areaData.lightGroup) {
      console.log(`  ⚠ Skipping ${area.name}: no light group`)
      continue
    }

    const visibleToUsers = areaConfig.visible_to_users || null

    // Add preview card (wrapped in conditional if user-restricted)
    const previewCard = buildPreviewCard(area, prefix, areaData, defaultSceneSuffix)
    previewCards.push(wrapWithUserCondition(previewCard, visibleToUsers))

    // Add details popup (wrapped in conditional if user-restricted) - collected separately
    const detailsPopup = buildDetailsPopup(area, prefix, areaData, defaultSceneSuffix)
    popupCards.push(wrapWithUserCondition(detailsPopup, visibleToUsers))

    const userNote = visibleToUsers ? ` (${visibleToUsers.length} users)` : ''
    console.log(`  ✓ ${area.name}${userNote}`)
  }

  // Combine: all preview cards first, then all popup cards at the end
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
    // Extract prefix from scene entity_id (e.g., scene.lr_minimal -> lr_)
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
  // Filter out excluded areas
  const included = areas.filter(a => !excludedAreas.has(a.id))

  // Create pinned set for quick lookup
  const pinnedSet = new Set(pinnedAreas)

  // Separate pinned and unpinned
  const pinned = []
  const unpinned = []

  for (const area of included) {
    if (pinnedSet.has(area.id)) {
      pinned.push(area)
    } else {
      unpinned.push(area)
    }
  }

  // Sort pinned by their order in pinnedAreas
  pinned.sort((a, b) => pinnedAreas.indexOf(a.id) - pinnedAreas.indexOf(b.id))

  // Sort unpinned alphabetically by name
  unpinned.sort((a, b) => a.name.localeCompare(b.name))

  return [...pinned, ...unpinned]
}

function extractPrefix(entities, areaId) {
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

  // Find light group
  const lightGroup = `group.${prefix}lights`

  // Find AC entity (climate domain, ends with _ac)
  const acEntity = findAcEntity(areaEntities)

  // Find fan entity
  const fanEntity = findFanEntity(areaEntities)

  // Build lights list
  const lights = buildLightsList(areaEntities, excludedLights, includedLights)

  // Build other entities list (excluded lights + other stuff)
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
  // First try domain: fan
  const fan = entities.find(e => e.domain === 'fan')

  if (fan) return fan.entity_id

  // Then try switch with 'fan' in name/id
  const fanSwitch = entities.find(e =>
    e.domain === 'switch' && (
      e.entity_id.toLowerCase().includes('fan') ||
      e.name?.toLowerCase().includes('fan')
    )
  )

  return fanSwitch?.entity_id || null
}

function buildLightsList(entities, excludedLights, includedLights) {
  // Start with included lights (preserves order)
  const includedSet = new Set(includedLights)
  const result = []

  // Add included lights first (in order)
  for (const entityId of includedLights) {
    const entity = entities.find(e => e.entity_id === entityId)

    if (entity) {
      result.push(entity)
    } else {
      // Entity might be from different area (like a switch)
      result.push({ entity_id: entityId, name: null, })
    }
  }

  // Add remaining lights from area (not excluded, not already included)
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
    // Include if it's an excluded light
    if (excludedLights.has(e.entity_id)) return true

    // Exclude if already in lights section
    if (lightIds.has(e.entity_id)) return false

    // Exclude climate and fan (in their own section)
    if (e.entity_id === acEntity || e.entity_id === fanEntity) return false

    // Exclude scenes, sensors, automations, etc.
    // Domains that shouldn't appear in the dashboard
    const excludeDomains = [
      'scene', 'sensor', 'binary_sensor', 'automation', 'script',
      'climate', 'fan', 'group',
      'update',        // Firmware updates
      'button',        // Action buttons (not toggleable)
      'event',         // Event entities
      'number',        // Number inputs (settings)
      'select',        // Select inputs (settings)
      'camera',        // Camera feeds
      'device_tracker', // Tracking
      'person',        // Person entities
      'remote',        // Remote controls
      'image',         // Image entities
      'todo',          // Todo lists
      'tts',           // Text-to-speech
      'stt',           // Speech-to-text
      'conversation',  // Conversation agents
      'siren',         // Sirens (usually separate control)
      'time',          // Time inputs
      'date',          // Date inputs
      'datetime',      // DateTime inputs
    ]

    if (excludeDomains.includes(e.domain)) return false

    // Include switches and other controllable entities
    return true
  })
}

