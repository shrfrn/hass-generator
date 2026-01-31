// @ts-check
// Shared data preparation for dashboard generation
// This module is template-agnostic - it prepares area data that any template can use

import { extractPrefix } from '../../utils/entity.js'
import { getDashboardEntity, getSyncedEntityIds, resolveControls } from '../synced-entities.js'

/**
 * @typedef {Object} InventoryContext
 * @property {Map} entityMap - Entities grouped by area_id
 * @property {Map} sceneMap - Scenes grouped by area_id
 * @property {Array} allScenes - All scene entities for cross-area lookups
 */

/**
 * @typedef {Object} AreaContext
 * @property {Object} area - The area object from HA
 * @property {string} prefix - Area prefix (e.g., "lr_")
 * @property {Array} entities - Entities in this area
 * @property {Array} scenes - Scenes in this area
 */

/**
 * @typedef {Object} ConfigContext
 * @property {Set} excludedLights - Light entity IDs to exclude
 * @property {Array} includedLights - Light entity IDs to include
 * @property {Object} syncedEntities - Synced entity fixtures
 * @property {Set} syncedEntityIds - All entity IDs in synced fixtures
 * @property {Set} excludedScenes - Scene entity IDs to exclude
 * @property {Array} includedScenes - Scene entity IDs to include from other areas
 */

/**
 * Build inventory context from raw inventory data (computed once per run)
 * @param {Array} entities - All entities from inventory
 * @returns {InventoryContext}
 */
function buildInventoryContext(entities) {
	const entityMap = new Map()
	const sceneMap = new Map()
	const allScenes = []

	for (const entity of entities) {
		if (entity.domain === 'scene') {
			allScenes.push(entity)
			if (entity.area_id) {
				if (!sceneMap.has(entity.area_id)) sceneMap.set(entity.area_id, [])
				sceneMap.get(entity.area_id).push(entity)
			}
		}

		if (entity.area_id) {
			if (!entityMap.has(entity.area_id)) entityMap.set(entity.area_id, [])
			entityMap.get(entity.area_id).push(entity)
		}
	}

	return { entityMap, sceneMap, allScenes }
}

/**
 * Build area context for a specific area (computed once per area)
 * @param {Object} area - Area object from HA
 * @param {string} prefix - Area prefix
 * @param {InventoryContext} inventoryCtx - Inventory context
 * @returns {AreaContext}
 */
function buildAreaContext(area, prefix, inventoryCtx) {
	return {
		area,
		prefix,
		entities: inventoryCtx.entityMap.get(area.id) || [],
		scenes: inventoryCtx.sceneMap.get(area.id) || [],
	}
}

/**
 * Build merged config context from dashboard and generator configs
 * @param {Object} dashboardAreaConfig - Per-area dashboard config
 * @param {Object} generatorAreaConfig - Per-area generator config
 * @returns {ConfigContext}
 */
function buildConfigContext(dashboardAreaConfig, generatorAreaConfig) {
	const syncedEntities = generatorAreaConfig.syncedEntities || {}

	return {
		excludedLights: new Set(dashboardAreaConfig.excluded_lights || []),
		includedLights: dashboardAreaConfig.included_lights || [],
		syncedEntities,
		syncedEntityIds: getSyncedEntityIds(syncedEntities),
		excludedScenes: new Set(dashboardAreaConfig.excluded_scenes || []),
		includedScenes: dashboardAreaConfig.included_scenes || [],
	}
}

/**
 * Prepare area data for all areas based on inventory and config
 * @param {object} inventory - The HASS inventory data
 * @param {object} config - Dashboard config
 * @param {object} generatorConfig - Generator config (for syncedEntities, etc.)
 * @returns {Array} Array of areaData objects
 */
export function prepareAllAreaData(inventory, config, generatorConfig = {}) {
	const { areas, entities } = inventory
	const excludedAreas = new Set(config.excluded_areas || [])
	const pinnedAreas = config.pinned_areas || []

	// Build inventory context once
	const inventoryCtx = buildInventoryContext(entities)

	const sortedAreas = sortAreas(areas, pinnedAreas, excludedAreas)
	const result = []

	for (const area of sortedAreas) {
		const prefix = extractPrefix(entities, area.id)

		if (!prefix) {
			console.log(`  ⚠ Skipping ${area.name}: no prefix detected`)
			continue
		}

		// Build contexts for this area
		const areaCtx = buildAreaContext(area, prefix, inventoryCtx)
		const dashboardAreaConfig = config.areas?.[area.id] || {}
		const generatorAreaConfig = generatorConfig.areas?.[area.id] || {}
		const configCtx = buildConfigContext(dashboardAreaConfig, generatorAreaConfig)

		const areaData = buildAreaData(areaCtx, configCtx, inventoryCtx)

		if (!areaData.lightGroup) {
			console.log(`  ⚠ Skipping ${area.name}: no light group`)
			continue
		}

		result.push({
			area,
			prefix,
			areaConfig: dashboardAreaConfig,
			visibleToUsers: dashboardAreaConfig.visible_to_users || null,
			...areaData,
		})
	}

	return result
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

/**
 * Build area data using structured contexts
 * @param {AreaContext} areaCtx - Area context
 * @param {ConfigContext} configCtx - Merged config context
 * @param {InventoryContext} inventoryCtx - Inventory context
 * @returns {Object} Area data with lights, scenes, etc.
 */
function buildAreaData(areaCtx, configCtx, inventoryCtx) {
	const { prefix, entities, scenes } = areaCtx
	const { excludedLights, includedLights, syncedEntities, syncedEntityIds, excludedScenes, includedScenes } = configCtx

	const lightGroup = `group.${prefix}lights`
	const acEntity = findAcEntity(entities)
	const fanEntity = findFanEntity(entities)
	const lights = buildLightsList(entities, excludedLights, includedLights, syncedEntities, syncedEntityIds)
	const otherEntities = buildOtherList(entities, lights, acEntity, fanEntity, configCtx)
	const scenesList = buildScenesList(scenes, excludedScenes, includedScenes, inventoryCtx.allScenes)

	return {
		lightGroup,
		acEntity,
		fanEntity,
		scenes: scenesList,
		lights,
		otherEntities,
	}
}

function findAcEntity(entities) {
	const ac = entities.find(e => e.domain === 'climate' && e.entity_id.endsWith('_ac'))
	return ac?.entity_id || null
}

function findFanEntity(entities) {
	const fan = entities.find(e => e.domain === 'fan')
	if (fan) return fan.entity_id

	const fanSwitch = entities.find(e =>
		e.domain === 'switch' && (
			e.entity_id.toLowerCase().includes('fan') ||
			e.name?.toLowerCase().includes('fan')
		),
	)

	return fanSwitch?.entity_id || null
}

function buildLightsList(entities, excludedLights, includedLights, syncedEntities, syncedEntityIds) {
	const includedSet = new Set(includedLights)

	const result = []

	// Add synced fixtures as dashboard entities first
	for (const [fixtureId, fixture] of Object.entries(syncedEntities)) {
		const dashboardInfo = getDashboardEntity(fixtureId, fixture)

		// Skip if fixture's dashboard entity is excluded
		if (excludedLights.has(dashboardInfo.entity_id)) continue

		// Determine if fixture has advanced controls (color_temp, rgb, etc.)
		const dimmables = fixture.entities.filter(e => {
			const controls = resolveControls(e.controls)
			return controls.includes('brightness')
		})
		const primaryControls = dimmables[0] ? resolveControls(dimmables[0].controls) : ['on', 'off']
		const hasAdvancedControls = primaryControls.some(c => ['color_temp', 'rgb', 'hs', 'xy'].includes(c))

		result.push({
			entity_id: dashboardInfo.entity_id,
			name: fixture.name,
			dimmable: dashboardInfo.dimmable,
			brightness_entity: dashboardInfo.entity_id,
			toggle_entity: dashboardInfo.toggle_entity,
			has_advanced_controls: hasAdvancedControls,
			is_synced_fixture: true, // Use fixture name directly, skip translation lookup
			...(fixture.icon && { icon: fixture.icon }),
		})
	}

	// Add explicitly included lights
	for (const entityId of includedLights) {
		if (syncedEntityIds.has(entityId)) continue

		const entity = entities.find(e => e.entity_id === entityId)

		if (entity) {
			result.push(enrichWithDimming(entity))
		} else {
			result.push({ entity_id: entityId, name: null, dimmable: false, brightness_entity: entityId, toggle_entity: entityId, has_advanced_controls: false })
		}
	}

	// Add area lights (excluding already included and synced)
	const areaLights = entities.filter(e =>
		e.domain === 'light' &&
		!excludedLights.has(e.entity_id) &&
		!includedSet.has(e.entity_id) &&
		!syncedEntityIds.has(e.entity_id),
	)

	result.push(...areaLights.map(enrichWithDimming))

	return result
}

function enrichWithDimming(entity) {
	const modes = entity.attributes?.supported_color_modes || []
	const isOnOffOnly = modes.length === 0 || (modes.length === 1 && modes[0] === 'onoff')
	const colorModes = ['color_temp', 'hs', 'xy', 'rgb', 'rgbw', 'rgbww']
	const hasAdvancedControls = modes.some(m => colorModes.includes(m))

	return {
		...entity,
		dimmable: !isOnOffOnly,
		brightness_entity: entity.entity_id,
		toggle_entity: entity.entity_id,
		has_advanced_controls: hasAdvancedControls,
	}
}

/**
 * Build list of "other" entities (not lights, climate, fan, etc.)
 * @param {Array} entities - Area entities
 * @param {Array} lightsInSection - Lights already in the lights section
 * @param {string|null} acEntity - AC entity ID to exclude
 * @param {string|null} fanEntity - Fan entity ID to exclude
 * @param {ConfigContext} configCtx - Config context
 * @returns {Array} Filtered entities for "other" section
 */
function buildOtherList(entities, lightsInSection, acEntity, fanEntity, configCtx) {
	const { excludedLights, syncedEntityIds } = configCtx
	const lightIds = new Set(lightsInSection.map(l => l.entity_id))

	const excludeDomains = [
		'scene', 'sensor', 'binary_sensor', 'automation', 'script',
		'climate', 'fan', 'group', 'update', 'button', 'event',
		'number', 'select', 'camera', 'device_tracker', 'person',
		'remote', 'image', 'todo', 'tts', 'stt', 'conversation',
		'siren', 'time', 'date', 'datetime',
	]

	return entities
		.filter(e => {
			if (excludedLights.has(e.entity_id)) return true
			if (lightIds.has(e.entity_id)) return false
			if (syncedEntityIds.has(e.entity_id)) return false
			if (e.entity_id === acEntity || e.entity_id === fanEntity) return false
			if (excludeDomains.includes(e.domain)) return false

			return true
		})
		.map(e => excludedLights.has(e.entity_id) ? enrichWithDimming(e) : e)
}

/**
 * Build scenes list with includes/excludes and cross-area scenes
 * @param {Array} areaScenes - Scenes assigned to this area
 * @param {Set} excludedScenes - Scene IDs to exclude
 * @param {Array} includedScenes - Scene IDs to include from other areas
 * @param {Array} allScenes - All scenes for cross-area lookups
 * @returns {Array} Filtered and combined scenes
 */
function buildScenesList(areaScenes, excludedScenes, includedScenes, allScenes) {
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
