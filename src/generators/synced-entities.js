// @ts-check
// Helper functions for generating synced entities (templates, groups, automations)

/**
 * Resolve controls shorthand to array
 * @param {string | string[] | undefined} controls
 * @returns {string[]}
 */
export function resolveControls(controls) {
	if (!controls) return ['on', 'off']
	if (Array.isArray(controls)) return controls

	const shorthands = {
		toggle: ['on', 'off'],
		dimmable: ['on', 'off', 'brightness'],
		tunable: ['on', 'off', 'brightness', 'color_temp'],
		rgb: ['on', 'off', 'brightness', 'rgb'],
	}

	return shorthands[controls] || ['on', 'off']
}

/**
 * Get dimmable entities from a fixture (entities with brightness control)
 * @param {import('../types/config.d.ts').SyncedFixture} fixture
 * @returns {import('../types/config.d.ts').SyncedEntity[]}
 */
export function getDimmableEntities(fixture) {
	return fixture.entities.filter(e => {
		const controls = resolveControls(e.controls)
		return controls.includes('brightness')
	})
}

/**
 * Get sync entities from a fixture (entities with sync: true)
 * @param {import('../types/config.d.ts').SyncedFixture} fixture
 * @returns {import('../types/config.d.ts').SyncedEntity[]}
 */
export function getSyncEntities(fixture) {
	return fixture.entities.filter(e => e.sync)
}

/**
 * Determine what dashboard entity to use for a fixture
 * @param {string} fixtureId
 * @param {import('../types/config.d.ts').SyncedFixture} fixture
 * @returns {{ entity_id: string, toggle_entity: string, dimmable: boolean }}
 */
export function getDashboardEntity(fixtureId, fixture) {
	const dimmables = getDimmableEntities(fixture)

	if (fixture.power) {
		// Template light is dashboard entity
		return {
			entity_id: `light.${fixtureId}`,
			toggle_entity: `light.${fixtureId}`,
			dimmable: dimmables.length > 0,
		}
	}

	if (dimmables.length === 1) {
		// Single dimmable bulb is dashboard entity
		const syncEntities = getSyncEntities(fixture)
		const toggleEntity = syncEntities.find(e => !resolveControls(e.controls).includes('brightness'))

		return {
			entity_id: dimmables[0].entity_id,
			toggle_entity: toggleEntity?.entity_id || dimmables[0].entity_id,
			dimmable: true,
		}
	}

	if (dimmables.length > 1) {
		// Light group is dashboard entity
		const syncEntities = getSyncEntities(fixture)
		const toggleEntity = syncEntities.find(e => !resolveControls(e.controls).includes('brightness'))

		return {
			entity_id: `light.${fixtureId}_group`,
			toggle_entity: toggleEntity?.entity_id || `light.${fixtureId}_group`,
			dimmable: true,
		}
	}

	// No dimmables - use first sync entity
	const syncEntities = getSyncEntities(fixture)

	return {
		entity_id: syncEntities[0]?.entity_id || fixture.entities[0].entity_id,
		toggle_entity: syncEntities[0]?.entity_id || fixture.entities[0].entity_id,
		dimmable: false,
	}
}

/**
 * Build wait template for multiple bulbs to come online
 * @param {string[]} entityIds
 * @returns {string}
 */
function buildWaitTemplate(entityIds) {
	if (entityIds.length === 1) {
		return `{{ states('${entityIds[0]}') != 'unavailable' }}`
	}

	const conditions = entityIds.map(e => `states('${e}') != 'unavailable'`).join(' and ')
	return `{{ ${conditions} }}`
}

/**
 * Generate a template light for a fixture with power control
 * @param {string} fixtureId
 * @param {import('../types/config.d.ts').SyncedFixture} fixture
 * @returns {object}
 */
export function generateTemplateLight(fixtureId, fixture) {
	if (!fixture.power) return null

	const dimmables = getDimmableEntities(fixture)
	const dimmableIds = dimmables.map(e => e.entity_id)
	const primaryDimmable = dimmables[0]

	// Get controls from primary dimmable to determine template capabilities
	const controls = primaryDimmable ? resolveControls(primaryDimmable.controls) : ['on', 'off']

	const templateLight = {
		name: fixture.name,
		unique_id: fixtureId,
		state: `{{ is_state('${fixture.power}', 'on') }}`,
		turn_on: [{ service: 'light.turn_on', target: { entity_id: fixture.power } }],
		turn_off: [{ service: 'light.turn_off', target: { entity_id: fixture.power } }],
	}

	// Add level attribute and set_level action if dimmable
	if (controls.includes('brightness') && primaryDimmable) {
		templateLight.level = `{{ state_attr('${primaryDimmable.entity_id}', 'brightness') | default(0) }}`
		templateLight.set_level = [
			{ service: 'light.turn_on', target: { entity_id: fixture.power } },
			{ wait_template: buildWaitTemplate(dimmableIds), timeout: '00:00:05' },
			{
				service: 'light.turn_on',
				target: { entity_id: dimmableIds },
				data: { brightness: '{{ brightness }}' },
			},
		]
	}

	// Add color_temp if tunable
	if (controls.includes('color_temp') && primaryDimmable) {
		templateLight.color_temp = `{{ state_attr('${primaryDimmable.entity_id}', 'color_temp') }}`
		templateLight.set_color_temp = [
			{ service: 'light.turn_on', target: { entity_id: fixture.power } },
			{ wait_template: buildWaitTemplate(dimmableIds), timeout: '00:00:05' },
			{
				service: 'light.turn_on',
				target: { entity_id: dimmableIds },
				data: { color_temp: '{{ color_temp }}' },
			},
		]
	}

	// Add rgb if supported
	if (controls.includes('rgb') && primaryDimmable) {
		templateLight.rgb_color = `{{ state_attr('${primaryDimmable.entity_id}', 'rgb_color') }}`
		templateLight.set_rgb = [
			{ service: 'light.turn_on', target: { entity_id: fixture.power } },
			{ wait_template: buildWaitTemplate(dimmableIds), timeout: '00:00:05' },
			{
				service: 'light.turn_on',
				target: { entity_id: dimmableIds },
				data: { rgb_color: '{{ rgb }}' },
			},
		]
	}

	return { light: [templateLight] }
}

/**
 * Generate a light group for multi-bulb fixtures without power control
 * @param {string} fixtureId
 * @param {import('../types/config.d.ts').SyncedFixture} fixture
 * @returns {object | null}
 */
export function generateLightGroup(fixtureId, fixture) {
	// Only generate group when power is null and multiple dimmables
	if (fixture.power) return null

	const dimmables = getDimmableEntities(fixture)
	if (dimmables.length <= 1) return null

	return [{
		platform: 'group',
		name: fixture.name,
		unique_id: `${fixtureId}_group`,
		entities: dimmables.map(e => e.entity_id),
	}]
}

/**
 * Generate sync automation for entities with sync: true
 * @param {string} fixtureId
 * @param {import('../types/config.d.ts').SyncedFixture} fixture
 * @returns {object | null}
 */
export function generateSyncAutomation(fixtureId, fixture) {
	const syncEntities = getSyncEntities(fixture)
	if (syncEntities.length < 2) return null

	const entityIds = syncEntities.map(e => e.entity_id)

	// Determine service domain from first entity
	const domain = entityIds[0].split('.')[0]
	const serviceDomain = domain === 'switch' ? 'switch' : 'light'

	return {
		id: `sync_${fixtureId}`,
		alias: `Sync ${fixture.name}`,
		trigger: [{
			platform: 'state',
			entity_id: entityIds,
			to: ['on', 'off'],
		}],
		condition: [{
			condition: 'template',
			value_template: '{{ trigger.to_state.state != trigger.from_state.state }}',
		}],
		action: [{
			service: `${serviceDomain}.turn_{{ trigger.to_state.state }}`,
			target: {
				entity_id: `{% set triggered = trigger.entity_id %}\n{% set all = ${JSON.stringify(entityIds)} %}\n{{ all | reject('eq', triggered) | list }}`,
			},
		}],
	}
}

/**
 * Process all synced entities for an area and return YAML structures
 * @param {Record<string, import('../types/config.d.ts').SyncedFixture>} syncedEntities
 * @returns {{ templates: object[], lightGroups: object[], automations: object[] }}
 */
export function processSyncedEntities(syncedEntities) {
	const templates = []
	const lightGroups = []
	const automations = []

	for (const [fixtureId, fixture] of Object.entries(syncedEntities)) {
		// Generate template light (if power entity set)
		const templateLight = generateTemplateLight(fixtureId, fixture)
		if (templateLight) templates.push(templateLight)

		// Generate light group (if power null + multiple dimmables)
		const lightGroup = generateLightGroup(fixtureId, fixture)
		if (lightGroup) lightGroups.push(...lightGroup)

		// Generate sync automation
		const syncAutomation = generateSyncAutomation(fixtureId, fixture)
		if (syncAutomation) automations.push(syncAutomation)
	}

	return { templates, lightGroups, automations }
}

/**
 * Get all entity IDs from synced entities that should be excluded from normal light lists
 * @param {Record<string, import('../types/config.d.ts').SyncedFixture>} syncedEntities
 * @returns {Set<string>}
 */
export function getSyncedEntityIds(syncedEntities) {
	const ids = new Set()

	for (const fixture of Object.values(syncedEntities)) {
		for (const entity of fixture.entities) {
			ids.add(entity.entity_id)
		}
	}

	return ids
}
