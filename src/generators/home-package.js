import { join } from 'path'
import { writeYamlFile } from './yaml-utils.js'

export async function generateHomePackage(inventory, packagesDir) {
  console.log('\nGenerating home package...')

  const { entities } = inventory
  const persons = entities.filter(e => e.domain === 'person')

  const binarySensors = persons.map(person => {
    const firstName = extractFirstName(person.name)
    const sensorId = `${firstName.toLowerCase()}_home`

    return {
      name: `${firstName} Home`,
      unique_id: sensorId,
      state: `{{ is_state('${person.entity_id}', 'home') }}`,
      device_class: 'presence',
    }
  })

  const pkg = {
    template: [
      { binary_sensor: binarySensors, },
    ],
  }

  const header = `# ============================================================
# Home Package
# ============================================================
# Global helpers not tied to a specific area
# ============================================================\n`

  const filePath = join(packagesDir, 'home.yaml')
  await writeYamlFile(filePath, pkg, header)

  console.log('  ✓ home.yaml')

  return ['home.yaml']
}

function extractFirstName(fullName) {
  return fullName.split(' ')[0]
}

