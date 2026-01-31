// @ts-check
import { join } from 'path'
import { writeYamlFile, generateHeader } from './yaml-utils.js'
import { extractPrefix } from '../utils/entity.js'
import { sanitizeFileName } from '../utils/strings.js'
import { processSyncedEntities, getSyncedEntityIds, getGeneratedGroupEntityIds, getWrapperEntityIds } from './synced-entities.js'

export async function generateAreaPackages(inventory, config, packagesDir) {
	const { areas, entities, scenes } = inventory
	const areasDir = join(packagesDir, 'areas')
	const createdFiles = []

	console.log('\nGenerating area packages...')

	for (const area of areas) {
		const areaConfig = config.areas?.[area.id] || {}
		const prefix = extractPrefix(entities, area.id)

		if (!prefix) {
			console.log(`  ⚠ Skipping ${area.name}: no prefix detected`)
			continue
		}

		const ctx = { area, entities, scenes, areaConfig, globalConfig: config, prefix }
		const { pkg, includeExcludeInfo } = buildAreaPackage(ctx)
		const fileName = `${prefix}${sanitizeFileName(area.id)}.yaml`
		const filePath = join(areasDir, fileName)
		const header = generateHeader(area.name, prefix, includeExcludeInfo)

		await writeYamlFile(filePath, pkg, header)
		createdFiles.push(`areas/${fileName}`)
		console.log(`  ✓ ${fileName}`)
	}

	return createdFiles
}


function buildAreaPackage(ctx) {
	const { area, entities, scenes, areaConfig, globalConfig, prefix } = ctx
	const { lightGroup, included, excluded } = buildLightGroup({ area, entities, areaConfig, globalConfig })

	const pkg = {
		...buildLightGroupSection(lightGroup, prefix),
		input_select: { [`${prefix}active_scene`]: buildSceneSelector(area, getAreaScenes(scenes, prefix)) },
		input_datetime: { [`${prefix}last_presence`]: { name: `${area.name} Last Presence`, has_date: true, has_time: true } },
		input_boolean: { [`${prefix}pause_automations`]: { name: `${area.name} Pause Automations`, icon: 'mdi:pause-circle' } },
		timer: { [`${prefix}vacancy`]: buildVacancyTimer(area, areaConfig, globalConfig) },
		...buildSyncedEntitiesSection(areaConfig.syncedEntities),
	}

	return { pkg, includeExcludeInfo: { included, excluded } }
}

function buildLightGroupSection(lightGroup, prefix) {
	return lightGroup ? { group: { [`${prefix}lights`]: lightGroup } } : {}
}

function buildVacancyTimer(area, areaConfig, globalConfig) {
	const duration = areaConfig.vacancy_timer_duration || globalConfig.default_vacancy_duration || '00:10:00'
	return { name: `${area.name} Vacancy Timer`, duration }
}

function buildSyncedEntitiesSection(syncedEntities) {
	if (!syncedEntities) return {}

	const { templateLights, lightGroups, automations, inputNumbers, scripts } = processSyncedEntities(syncedEntities)
	const result = {}

	// Input numbers for brightness tracking (avoids stale Zigbee values)
	if (Object.keys(inputNumbers).length > 0) result.input_number = inputNumbers

	// Scripts for flood protection (mode: single)
	if (Object.keys(scripts).length > 0) result.script = scripts

	// Template lights use legacy platform format - combine with light groups under 'light:'
	const allLights = [...templateLights, ...lightGroups]
	if (allLights.length > 0) result.light = allLights

	if (automations.length > 0) result.automation = automations

	return result
}

function buildLightGroup({ area, entities, areaConfig, globalConfig }) {
	const includes = areaConfig.include_in_group || []
	const includeSet = new Set(includes)
	const excludeList = areaConfig.exclude_from_group || []
	const excludeSet = new Set(excludeList)

	// Synced entities: exclude raw bulbs and internal _group so area group lists template only
	const syncedEntityIds = areaConfig.syncedEntities ? getSyncedEntityIds(areaConfig.syncedEntities) : new Set()
	const generatedGroupIds = new Set(getGeneratedGroupEntityIds(areaConfig.syncedEntities))

	// Determine which labels to exclude (area overrides global, no hardcoded defaults)
	const globalExcludedLabels = globalConfig.excluded_labels || []
	const areaExcludedLabels = areaConfig.excluded_labels

	// Use area labels if defined, otherwise global
	const excludedLabels = new Set(areaExcludedLabels ?? globalExcludedLabels)
	const includedLabels = new Set(areaConfig.included_labels || [])

	// Get lights from this area (domain: light only)
	const areaLights = entities
		.filter(e => e.area_id === area.id && e.domain === 'light')
		.filter(e => !syncedEntityIds.has(e.entity_id))
		.filter(e => !generatedGroupIds.has(e.entity_id))
		.filter(e => {
			const entityLabels = e.labels || []

			// Check if entity has an included label (overrides exclusion)
			const hasIncludedLabel = entityLabels.some(label => includedLabels.has(label))
			if (hasIncludedLabel) return true

			// Check if entity has an excluded label
			const hasExcludedLabel = entityLabels.some(label => excludedLabels.has(label))

			// Include if: no excluded label OR explicitly included by entity ID
			return !hasExcludedLabel || includeSet.has(e.entity_id)
		})
		.map(e => e.entity_id)
		.filter(id => !excludeSet.has(id))

	// Include template light (light.${fixtureId}) for each synced fixture so scenes/automations target one entity
	const wrapperEntityIds = getWrapperEntityIds(areaConfig.syncedEntities)
	const allLights = [...new Set([...areaLights, ...includes, ...wrapperEntityIds])]

	if (allLights.length === 0) {
		return { lightGroup: null, included: [], excluded: [] }
	}

	const lightGroup = {
		name: `${area.name} Lights`,
		entities: allLights.sort(),
	}

	return {
		lightGroup,
		included: includes,
		excluded: excludeList,
	}
}

function getAreaScenes(scenes, prefix) {
	return scenes
		.filter(s => s.entity_id.includes(`.${prefix}`))
		.map(s => s.entity_id)
}

function buildSceneSelector(area, areaScenes) {
	const options = ['none', ...areaScenes]

	return {
		name: `${area.name} Active Scene`,
		options,
		initial: 'none',
	}
}

