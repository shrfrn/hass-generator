import { join } from 'path'
import { writeYamlFile, generateFloorHeader } from './yaml-utils.js'

export async function generateFloorPackages(inventory, packagesDir) {
  const { floors, areas, entities, } = inventory
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

function sanitizeFileName(str) {
  return str.replace(/[^a-z0-9_]/gi, '_').toLowerCase()
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

