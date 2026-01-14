// @ts-check
import { existsSync, readFileSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import YAML from 'yaml'
import { cwdPath } from '../paths.js'
import { extractPrefix } from '../utils/entity.js'

export async function generateSceneTemplates(inventory, config, packagesDir) {
	const { areas, entities } = inventory
	const scenesPath = cwdPath('scenes.yaml')

	console.log('\nGenerating scene templates...')

	// Read existing scenes
	const existingScenes = readExistingScenes(scenesPath)

	// Filter out old auto-generated templates (name ends with _template)
	const manualScenes = existingScenes.filter(s => !s.name?.endsWith('_template'))

	// Generate new templates
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

	// Combine: manual scenes first, then templates
	const allScenes = [...manualScenes, ...templateScenes]

	// Write back to scenes.yaml
	writeFileSync(scenesPath, YAML.stringify(allScenes, { lineWidth: 0 }))

	console.log(`  → Updated scenes.yaml (${templateScenes.length} templates)`)

	// Clean up old scene-templates directory if it exists
	const oldTemplatesDir = join(packagesDir, 'scene-templates')
	if (existsSync(oldTemplatesDir)) {
		rmSync(oldTemplatesDir, { recursive: true })
		console.log('  → Removed old packages/scene-templates/')
	}

	return []
}

function readExistingScenes(scenesPath) {
	if (!existsSync(scenesPath)) return []

	const content = readFileSync(scenesPath, 'utf-8')
	if (!content.trim()) return []

	try {
		return YAML.parse(content) || []
	} catch {
		console.log('  ⚠ Could not parse scenes.yaml, starting fresh')
		return []
	}
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
