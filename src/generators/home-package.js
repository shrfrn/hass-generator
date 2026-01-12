// @ts-check
import { join } from 'path'
import { writeYamlFile } from './yaml-utils.js'
import { extractFirstName } from '../utils/strings.js'

/**
 * Generate home.yaml package with person presence sensors and aggregates
 * @param {object} inventory - HASS inventory data
 * @param {string} packagesDir - Output directory for packages
 * @returns {Promise<string[]>} List of generated files
 */
export async function generateHomePackage(inventory, packagesDir) {
	console.log('\nGenerating home package...')

	const { entities } = inventory
	const persons = entities.filter(e => e.domain === 'person')

	// Per-person sensors
	const personSensors = persons.map(person => {
		const firstName = extractFirstName(person.name)
		const sensorId = `${firstName.toLowerCase()}_home`

		return {
			name: `${firstName} Home`,
			unique_id: sensorId,
			state: `{{ is_state('${person.entity_id}', 'home') }}`,
			device_class: 'presence',
		}
	})

	// Aggregate sensors
	const personIds = persons.map(p => `'${p.entity_id}'`).join(', ')

	const aggregateSensors = [
		{
			name: 'Anyone Home',
			unique_id: 'anyone_home',
			state: `{{ [${personIds}] | select('is_state', 'home') | list | count > 0 }}`,
			device_class: 'presence',
		},
		{
			name: 'Everyone Home',
			unique_id: 'everyone_home',
			state: `{{ [${personIds}] | reject('is_state', 'home') | list | count == 0 }}`,
			device_class: 'presence',
		},
	]

	// Count sensor
	const countSensor = {
		name: 'People Home Count',
		unique_id: 'people_home_count',
		state: `{{ [${personIds}] | select('is_state', 'home') | list | count }}`,
		icon: 'mdi:account-group',
	}

	// Trigger-based timestamp sensors
	const arrivedHomeTrigger = {
		trigger: [
			{
				platform: 'state',
				entity_id: 'binary_sensor.anyone_home',
				from: 'off',
				to: 'on',
			},
		],
		sensor: [
			{
				name: 'Home Became Occupied',
				unique_id: 'home_became_occupied',
				state: '{{ now().isoformat() }}',
				device_class: 'timestamp',
				icon: 'mdi:home-account',
			},
		],
	}

	const leftHomeTrigger = {
		trigger: [
			{
				platform: 'state',
				entity_id: 'binary_sensor.anyone_home',
				from: 'on',
				to: 'off',
			},
		],
		sensor: [
			{
				name: 'Home Became Empty',
				unique_id: 'home_became_empty',
				state: '{{ now().isoformat() }}',
				device_class: 'timestamp',
				icon: 'mdi:home-outline',
			},
		],
	}

	const pkg = {
		template: [
			{
				binary_sensor: [...personSensors, ...aggregateSensors],
				sensor: [countSensor],
			},
			arrivedHomeTrigger,
			leftHomeTrigger,
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


