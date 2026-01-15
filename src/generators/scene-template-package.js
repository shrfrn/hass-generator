// @ts-check
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import YAML from 'yaml'
import { cwdPath } from '../paths.js'
import { extractPrefix } from '../utils/entity.js'

export async function generateSceneTemplates(inventory, config, packagesDir) {
	const { areas, entities } = inventory

	// Generated scenes go to scenes/generated.yaml (separate from UI-managed scenes.yaml)
	const scenesDir = cwdPath('scenes')
	const generatedPath = join(scenesDir, 'generated.yaml')

	console.log('\nGenerating scene templates...')

	// Ensure scenes directory exists
	if (!existsSync(scenesDir)) mkdirSync(scenesDir, { recursive: true })

	const templateScenes = []

	for (const area of areas) {
		const areaConfig = config.areas?.[area.id] || {}
		const prefix = extractPrefix(entities, area.id)

		if (!prefix) continue

		const lightEntities = getAreaLightEntities(area, entities, areaConfig, config, prefix)

		if (lightEntities.length === 0) {
			console.log(`  ⚠ Skipping ${area.name}: no light entities`)
			continue
		}

		const template = buildSceneTemplate(area, lightEntities, prefix)
		templateScenes.push(template)
		console.log(`  ✓ ${prefix}template`)
	}

	// Write generated scenes to separate file (no merge with UI scenes needed)
	writeFileSync(generatedPath, YAML.stringify(templateScenes, { lineWidth: 0 }))

	console.log(`  → Updated scenes/generated.yaml (${templateScenes.length} templates)`)

	// Clean up old scene-templates directory if it exists
	const oldTemplatesDir = join(packagesDir, 'scene-templates')
	if (existsSync(oldTemplatesDir)) {
		rmSync(oldTemplatesDir, { recursive: true })
		console.log('  → Removed old packages/scene-templates/')
	}

	return []
}

function getAreaLightEntities(area, entities, areaConfig, globalConfig, _prefix) {
	const includes = areaConfig.include_in_group || []
	const includeSet = new Set(includes)
	const excludeList = areaConfig.exclude_from_group || []
	const excludeSet = new Set(excludeList)

	const dimmableCompanions = areaConfig.dimmable_companions || {}
	const companionBulbs = new Set(Object.values(dimmableCompanions))

	const globalExcludedLabels = globalConfig.excluded_labels || []
	const areaExcludedLabels = areaConfig.excluded_labels

	const excludedLabels = new Set(areaExcludedLabels ?? globalExcludedLabels)
	const includedLabels = new Set(areaConfig.included_labels || [])

	const areaLights = entities
		.filter(e => e.area_id === area.id && e.domain === 'light')
		.filter(e => !companionBulbs.has(e.entity_id))
		.filter(e => {
			const entityLabels = e.labels || []
			const hasIncludedLabel = entityLabels.some(label => includedLabels.has(label))
			if (hasIncludedLabel) return true

			const hasExcludedLabel = entityLabels.some(label => excludedLabels.has(label))
			return !hasExcludedLabel || includeSet.has(e.entity_id)
		})
		.filter(e => !excludeSet.has(e.entity_id))

	const allLights = [...areaLights, ...entities.filter(e => includes.includes(e.entity_id))]

	return allLights.sort((a, b) => a.entity_id.localeCompare(b.entity_id))
}

function buildSceneTemplate(area, lightEntities, prefix) {
	// Use a stable ID based on prefix so it doesn't change on regenerate
	const stableId = `template_${prefix.replace('_', '')}`

	const scene = {
		id: stableId,
		name: `${prefix}template`,
		icon: 'mdi:content-copy',
		entities: {},
		metadata: {},
	}

	for (const entity of lightEntities) {
		if (entity.domain === 'light') {
			scene.entities[entity.entity_id] = { state: 'on' }
		} else if (entity.domain === 'switch') {
			scene.entities[entity.entity_id] = { state: 'on' }
		}

		scene.metadata[entity.entity_id] = { entity_only: true }
	}

	return scene
}
