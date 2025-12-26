import { sendCommand } from './websocket.js'

export async function fetchStates() {
  console.log('Fetching entity states...')
  const states = await sendCommand('get_states')
  console.log(`  Found ${states.length} entities`)
  return states
}

export async function fetchAreas() {
  console.log('Fetching areas...')
  const areas = await sendCommand('config/area_registry/list')
  console.log(`  Found ${areas.length} areas`)
  return areas
}

export async function fetchFloors() {
  console.log('Fetching floors...')

  try {
    const floors = await sendCommand('config/floor_registry/list')
    console.log(`  Found ${floors.length} floors`)
    return floors
  } catch (err) {
    console.log('  Floors not supported (requires HA 2024.1+)')
    return []
  }
}

export async function fetchDevices() {
  console.log('Fetching devices...')
  const devices = await sendCommand('config/device_registry/list')
  console.log(`  Found ${devices.length} devices`)
  return devices
}

export async function fetchEntityRegistry() {
  console.log('Fetching entity registry...')
  const entities = await sendCommand('config/entity_registry/list')
  console.log(`  Found ${entities.length} entity registry entries`)
  return entities
}

export async function fetchLabels() {
  console.log('Fetching labels...')

  try {
    const labels = await sendCommand('config/label_registry/list')
    console.log(`  Found ${labels.length} labels`)
    return labels
  } catch (err) {
    console.log('  Labels not supported (requires HA 2024.4+)')
    return []
  }
}

export async function fetchZones() {
  console.log('Fetching zones...')

  try {
    const zones = await sendCommand('zone/list')
    console.log(`  Found ${zones.length} zones`)
    return zones
  } catch (err) {
    console.log('  Could not fetch zones, extracting from states')
    return null // will be extracted from states
  }
}

export async function fetchPersons() {
  console.log('Fetching persons...')

  try {
    const persons = await sendCommand('person/list')
    console.log(`  Found ${persons.storage.length + persons.config.length} persons`)
    return persons
  } catch (err) {
    console.log('  Could not fetch persons, extracting from states')
    return null // will be extracted from states
  }
}

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

