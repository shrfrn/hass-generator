// @ts-check
import { sendCommand } from './websocket.js'

/**
 * Fetch all entity states from Home Assistant
 * @returns {Promise<object[]>} Array of entity state objects
 */
export async function fetchStates() {
	console.log('Fetching entity states...')
	const states = await sendCommand('get_states')
	console.log(`  Found ${states.length} entities`)
	return states
}

/**
 * Fetch all areas from Home Assistant
 * @returns {Promise<object[]>} Array of area objects
 */
export async function fetchAreas() {
	console.log('Fetching areas...')
	const areas = await sendCommand('config/area_registry/list')
	console.log(`  Found ${areas.length} areas`)
	return areas
}

/**
 * Fetch all floors from Home Assistant (requires HA 2024.1+)
 * @returns {Promise<object[]>} Array of floor objects or empty array if not supported
 */
export async function fetchFloors() {
	console.log('Fetching floors...')

	try {
		const floors = await sendCommand('config/floor_registry/list')
		console.log(`  Found ${floors.length} floors`)
		return floors
	} catch {
		console.log('  Floors not supported (requires HA 2024.1+)')
		return []
	}
}

/**
 * Fetch all devices from Home Assistant
 * @returns {Promise<object[]>} Array of device objects
 */
export async function fetchDevices() {
	console.log('Fetching devices...')
	const devices = await sendCommand('config/device_registry/list')
	console.log(`  Found ${devices.length} devices`)
	return devices
}

/**
 * Fetch entity registry from Home Assistant
 * @returns {Promise<object[]>} Array of entity registry entries
 */
export async function fetchEntityRegistry() {
	console.log('Fetching entity registry...')
	const entities = await sendCommand('config/entity_registry/list')
	console.log(`  Found ${entities.length} entity registry entries`)
	return entities
}

/**
 * Fetch all labels from Home Assistant (requires HA 2024.4+)
 * @returns {Promise<object[]>} Array of label objects or empty array if not supported
 */
export async function fetchLabels() {
	console.log('Fetching labels...')

	try {
		const labels = await sendCommand('config/label_registry/list')
		console.log(`  Found ${labels.length} labels`)
		return labels
	} catch {
		console.log('  Labels not supported (requires HA 2024.4+)')
		return []
	}
}

/**
 * Fetch all zones from Home Assistant
 * @returns {Promise<object[]|null>} Array of zone objects or null to extract from states
 */
export async function fetchZones() {
	console.log('Fetching zones...')

	try {
		const zones = await sendCommand('zone/list')
		console.log(`  Found ${zones.length} zones`)
		return zones
	} catch {
		console.log('  Could not fetch zones, extracting from states')
		return null
	}
}

/**
 * Fetch all persons from Home Assistant
 * @returns {Promise<object|null>} Person list object or null to extract from states
 */
export async function fetchPersons() {
	console.log('Fetching persons...')

	try {
		const persons = await sendCommand('person/list')
		console.log(`  Found ${persons.storage.length + persons.config.length} persons`)
		return persons
	} catch {
		console.log('  Could not fetch persons, extracting from states')
		return null
	}
}

/**
 * Fetch all data from Home Assistant in parallel
 * @returns {Promise<object>} Object containing all fetched data
 */
export async function fetchAllData() {
	const [
		states,
		areas,
		floors,
		devices,
		entityRegistry,
		labels,
		zones,
		persons,
	] = await Promise.all([
		fetchStates(),
		fetchAreas(),
		fetchFloors(),
		fetchDevices(),
		fetchEntityRegistry(),
		fetchLabels(),
		fetchZones(),
		fetchPersons(),
	])

	return {
		states,
		areas,
		floors,
		devices,
		entityRegistry,
		labels,
		zones,
		persons,
	}
}

