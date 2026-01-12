// @ts-check
import { getHaVersion } from './websocket.js'

/**
 * Transform raw Home Assistant data into normalized inventory format
 * @param {object} rawData - Raw data from fetchers
 * @returns {object} Normalized inventory data
 */
export function transformData(rawData) {
	const { states, areas, floors, devices, entityRegistry, labels, zones, persons } = rawData

	const deviceMap = buildDeviceMap(devices)
	const entityRegistryMap = buildEntityRegistryMap(entityRegistry)

	return {
		metadata: buildMetadata(),
		floors: transformFloors(floors),
		areas: transformAreas(areas),
		devices: transformDevices(devices),
		labels: transformLabels(labels),
		entities: transformEntities(states, entityRegistryMap, deviceMap),
		scenes: extractScenes(states),
		zones: transformZones(zones, states),
		persons: transformPersons(persons, states),
	}
}

function buildMetadata() {
	return {
		generated_at: new Date().toISOString(),
		ha_version: getHaVersion(),
	}
}

function buildDeviceMap(devices) {
	const map = new Map()

	for (const device of devices) {
		map.set(device.id, device)
	}

	return map
}

function buildEntityRegistryMap(entityRegistry) {
	const map = new Map()

	for (const entry of entityRegistry) {
		map.set(entry.entity_id, entry)
	}

	return map
}

function transformFloors(floors) {
	return floors.map(floor => ({
		id: floor.floor_id,
		name: floor.name,
		level: floor.level,
		icon: floor.icon,
		aliases: floor.aliases || [],
	}))
}

function transformAreas(areas) {
	return areas.map(area => ({
		id: area.area_id,
		name: area.name,
		floor_id: area.floor_id,
		icon: area.icon,
		aliases: area.aliases || [],
		labels: area.labels || [],
	}))
}

function transformDevices(devices) {
	return devices.map(device => ({
		id: device.id,
		name: device.name || device.name_by_user,
		name_by_user: device.name_by_user,
		manufacturer: device.manufacturer,
		model: device.model,
		area_id: device.area_id,
		labels: device.labels || [],
		disabled_by: device.disabled_by,
		via_device_id: device.via_device_id,
		identifiers: device.identifiers,
		connections: device.connections,
	}))
}

function transformLabels(labels) {
	return labels.map(label => ({
		id: label.label_id,
		name: label.name,
		color: label.color,
		icon: label.icon,
		description: label.description,
	}))
}

function transformEntities(states, entityRegistryMap, deviceMap) {
	return states.map(state => {
		const registryEntry = entityRegistryMap.get(state.entity_id)
		const areaId = resolveAreaId(registryEntry, deviceMap)

		// Prefer registry name (user-customized) over state friendly_name (often auto-generated)
		const name = registryEntry?.name || state.attributes.friendly_name || null

		return {
			entity_id: state.entity_id,
			domain: state.entity_id.split('.')[0],
			name,
			state: state.state,
			attributes: state.attributes,
			area_id: areaId,
			device_id: registryEntry?.device_id || null,
			labels: registryEntry?.labels || [],
			platform: registryEntry?.platform || null,
			disabled_by: registryEntry?.disabled_by || null,
			hidden_by: registryEntry?.hidden_by || null,
			icon: registryEntry?.icon || state.attributes.icon || null,
		}
	})
}

function resolveAreaId(registryEntry, deviceMap) {
	if (!registryEntry) return null

	// entity has direct area assignment
	if (registryEntry.area_id) return registryEntry.area_id

	// inherit area from device
	if (registryEntry.device_id) {
		const device = deviceMap.get(registryEntry.device_id)
		if (device?.area_id) return device.area_id
	}

	return null
}

function extractScenes(states) {
	return states
		.filter(state => state.entity_id.startsWith('scene.'))
		.map(state => ({
			entity_id: state.entity_id,
			name: state.attributes.friendly_name,
			icon: state.attributes.icon,
		}))
}

function transformZones(zones, states) {
	// if zones were fetched via API
	if (zones) {
		return zones.map(zone => ({
			id: zone.id,
			name: zone.name,
			latitude: zone.latitude,
			longitude: zone.longitude,
			radius: zone.radius,
			icon: zone.icon,
			passive: zone.passive,
		}))
	}

	// fallback: extract from states
	return states
		.filter(state => state.entity_id.startsWith('zone.'))
		.map(state => ({
			id: state.entity_id.replace('zone.', ''),
			name: state.attributes.friendly_name,
			latitude: state.attributes.latitude,
			longitude: state.attributes.longitude,
			radius: state.attributes.radius,
			icon: state.attributes.icon,
			passive: state.attributes.passive || false,
		}))
}

function transformPersons(persons, states) {
	// if persons were fetched via API
	if (persons) {
		const allPersons = [...(persons.storage || []), ...(persons.config || [])]

		return allPersons.map(person => ({
			id: person.id,
			name: person.name,
			user_id: person.user_id,
			device_trackers: person.device_trackers || [],
			picture: person.picture,
		}))
	}

	// fallback: extract from states
	return states
		.filter(state => state.entity_id.startsWith('person.'))
		.map(state => ({
			id: state.entity_id.replace('person.', ''),
			name: state.attributes.friendly_name,
			user_id: state.attributes.user_id,
			device_trackers: state.attributes.source ? [state.attributes.source] : [],
			picture: state.attributes.entity_picture,
		}))
}

