// @ts-check
import { join } from 'path'
import { writeYamlFile, generateFloorHeader } from './yaml-utils.js'
import { extractPrefix } from '../utils/entity.js'
import { sanitizeFileName } from '../utils/strings.js'

export async function generateFloorPackages(inventory, packagesDir) {
	const { floors, areas, entities } = inventory
	const floorsDir = join(packagesDir, 'floors')
	const createdFiles = []

	if (!floors || floors.length === 0) {
		console.log('\nNo floors defined, skipping floor packages')
		return createdFiles
	}

	console.log('\nGenerating floor packages...')

	for (const floor of floors) {
		const floorAreas = areas.filter(a => a.floor_id === floor.id)

		if (floorAreas.length === 0) {
			console.log(`  ⚠ Skipping ${floor.name}: no areas assigned`)
			continue
		}

		const pkg = buildFloorPackage(floor, floorAreas, entities)
		const fileName = `floor_${sanitizeFileName(floor.id)}.yaml`
		const filePath = join(floorsDir, fileName)

		await writeYamlFile(filePath, pkg, generateFloorHeader(floor.name))
		createdFiles.push(`floors/${fileName}`)
		console.log(`  ✓ ${fileName}`)
	}

	return createdFiles
}

function buildFloorPackage(floor, floorAreas, entities) {
	const areaLightGroups = []

	for (const area of floorAreas) {
		const prefix = extractPrefix(entities, area.id)

		if (prefix) {
			areaLightGroups.push(`group.${prefix}lights`)
		}
	}

	if (areaLightGroups.length === 0) {
		return {}
	}

	const floorPrefix = `floor_${sanitizeFileName(floor.id)}_`

	return {
		group: {
			[`${floorPrefix}lights`]: {
				name: `${floor.name} Lights`,
				entities: areaLightGroups.sort(),
			},
		},
	}
}


