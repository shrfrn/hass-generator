// @ts-check
// Helper functions for generating synced entities (templates, groups, automations)

// Note: Labels cannot be added to automations/scripts in YAML packages.
// Labels are a UI-only feature in Home Assistant.

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
 * Get dimmable entities from a fixture (entities with entity_id and brightness control)
 * @param {import('../types/config.d.ts').SyncedFixture} fixture
 * @returns {import('../types/config.d.ts').SyncedEntity[]}
 */
export function getDimmableEntities(fixture) {
	return /** @type {import('../types/config.d.ts').SyncedEntity[]} */ (
		fixture.entities.filter(e => {
			if (!('entity_id' in e)) return false
			const controls = resolveControls(e.controls)
			return controls.includes('brightness')
		})
	)
}

/**
 * Get sync entities from a fixture (entities with sync: true and entity_id)
 * @param {import('../types/config.d.ts').SyncedFixture} fixture
 * @returns {import('../types/config.d.ts').SyncedEntity[]}
 */
export function getSyncEntities(fixture) {
	return /** @type {import('../types/config.d.ts').SyncedEntity[]} */ (
		fixture.entities.filter(e => e.sync && 'entity_id' in e)
	)
}

/**
 * Get device entities from a fixture (elements with device_id)
 * @param {import('../types/config.d.ts').SyncedFixture} fixture
 * @returns {import('../types/config.d.ts').SyncedDevice[]}
 */
export function getDeviceEntities(fixture) {
	return /** @type {import('../types/config.d.ts').SyncedDevice[]} */ (
		fixture.entities.filter(e => 'device_id' in e)
	)
}

/**
 * Get devices that use blueprints
 * @param {import('../types/config.d.ts').SyncedDevice[]} devices
 * @returns {import('../types/config.d.ts').SyncedDevice[]}
 */
export function getBlueprintDevices(devices) {
	return devices.filter(d => 'blueprint' in d && d.blueprint)
}

/**
 * Get devices that use dim config (generator-built automations)
 * @param {import('../types/config.d.ts').SyncedDevice[]} devices
 * @returns {import('../types/config.d.ts').SyncedDevice[]}
 */
export function getDimDevices(devices) {
	return devices.filter(d => 'dim' in d && d.dim)
}

/**
 * Get devices that use on/off only (no dim or blueprint)
 * @param {import('../types/config.d.ts').SyncedDevice[]} devices
 * @returns {import('../types/config.d.ts').SyncedDevice[]}
 */
export function getOnOffDevices(devices) {
	return devices.filter(d => !('dim' in d && d.dim) && !('blueprint' in d && d.blueprint))
}

/**
 * Determine what dashboard entity to use for a fixture.
 * Always the template light light.${fixtureId} so scenes, automations, and UI target one entity.
 * @param {string} fixtureId
 * @param {import('../types/config.d.ts').SyncedFixture} fixture
 * @returns {{ entity_id: string, toggle_entity: string, dimmable: boolean }}
 */
export function getDashboardEntity(fixtureId, fixture) {
	const dimmables = getDimmableEntities(fixture)

	return {
		entity_id: `light.${fixtureId}`,
		toggle_entity: `light.${fixtureId}`,
		dimmable: dimmables.length > 0,
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
 * Generate input_number helper for brightness tracking
 * Used to avoid stale brightness values from Zigbee bulbs after power cycles
 * @param {string} fixtureId
 * @param {import('../types/config.d.ts').SyncedFixture} fixture
 * @returns {object | null}
 */
export function generateBrightnessHelper(fixtureId, fixture) {
	if (!fixture.power) return null

	const dimmables = getDimmableEntities(fixture)
	if (dimmables.length === 0) return null

	const defaultBrightness = fixture.default_brightness ?? 254

	return {
		[`${fixtureId}_brightness`]: {
			name: `${fixture.name} Brightness`,
			min: 0,
			max: 255,
			step: 1,
			initial: defaultBrightness,
			mode: 'slider',
		},
	}
}

/**
 * Generate event throttler script for brightness control with flood protection
 * Uses mode: single to prevent concurrent calls from queuing
 * @param {string} fixtureId
 * @param {import('../types/config.d.ts').SyncedFixture} fixture
 * @returns {object | null}
 */
export function generateEventThrottlerScript(fixtureId, fixture) {
	if (!fixture.power) return null

	const dimmables = getDimmableEntities(fixture)
	if (dimmables.length === 0) return null

	const dimmableIds = dimmables.map(e => e.entity_id)
	const targetEntity = dimmableIds.length === 1 ? dimmableIds[0] : dimmableIds

	return {
		[`${fixtureId}_ev_throttler`]: {
			alias: `${fixture.name} Event Throttler`,
			mode: 'single',
			fields: {
				brightness: { description: 'Brightness level (0-255)' },
			},
			sequence: [
				{
					wait_template: buildWaitTemplate(dimmableIds),
					timeout: '00:00:05',
					continue_on_timeout: false,
				},
				{
					service: 'light.turn_on',
					target: { entity_id: targetEntity },
					data: { brightness: '{{ brightness }}' },
				},
				{
					service: 'input_number.set_value',
					target: { entity_id: `input_number.${fixtureId}_brightness` },
					data: { value: '{{ brightness }}' },
				},
			],
		},
	}
}

/**
 * Get the underlying light target for a fixture.
 * Always returns the group entity ID since groups are now always created.
 * @param {string} fixtureId
 * @param {import('../types/config.d.ts').SyncedFixture} fixture
 * @returns {string}
 */
function getUnderlyingLightTarget(fixtureId, fixture) {
	return `light.${fixtureId}_group`
}

/**
 * Generate a template light for a fixture.
 * With power: coordinates power + bulb/group. Without power: pass-through wrapper over bulb/group.
 * Always creates light.${fixtureId} so scenes, automations, and UI have one target.
 * Uses legacy light.template platform format (works in packages)
 * @param {string} fixtureId
 * @param {import('../types/config.d.ts').SyncedFixture} fixture
 * @returns {object}
 */
export function generateTemplateLight(fixtureId, fixture) {
	const dimmables = getDimmableEntities(fixture)
	const dimmableIds = dimmables.map(e => e.entity_id)
	const primaryDimmable = dimmables[0]
	const defaultBrightness = fixture.default_brightness ?? 254
	const controls = primaryDimmable ? resolveControls(primaryDimmable.controls) : ['on', 'off']
	const hasBrightness = controls.includes('brightness') && primaryDimmable

	if (fixture.power) {
		// Power-controlled: template coordinates power + bulb/group
		const templateLight = {
			friendly_name: fixture.name,
			value_template: `{{ is_state('${fixture.power}', 'on') }}`,
			turn_off: { service: 'light.turn_off', target: { entity_id: fixture.power } },
		}

		if (hasBrightness) {
			templateLight.turn_on = [
				{ service: 'light.turn_on', target: { entity_id: fixture.power } },
				{
					service: 'input_number.set_value',
					target: { entity_id: `input_number.${fixtureId}_brightness` },
					data: { value: defaultBrightness },
				},
			]
		} else {
			templateLight.turn_on = { service: 'light.turn_on', target: { entity_id: fixture.power } }
		}

		if (hasBrightness) {
			templateLight.level_template = `{{ states('input_number.${fixtureId}_brightness') | int }}`
			templateLight.set_level = [
				{
					choose: [
						{
							conditions: [
								{ condition: 'template', value_template: '{{ brightness | int > 0 }}' },
							],
							sequence: [
								{
									service: `script.${fixtureId}_ev_throttler`,
									data: { brightness: '{{ brightness }}' },
								},
							],
						},
					],
				},
			]
		}

		if (controls.includes('color_temp') && primaryDimmable) {
			templateLight.temperature_template = `{{ state_attr('${primaryDimmable.entity_id}', 'color_temp') }}`
			templateLight.set_temperature = [
				{ service: 'light.turn_on', target: { entity_id: fixture.power } },
				{ wait_template: buildWaitTemplate(dimmableIds), timeout: '00:00:05' },
				{
					service: 'light.turn_on',
					target: { entity_id: dimmableIds.length === 1 ? dimmableIds[0] : dimmableIds },
					data: { color_temp: '{{ color_temp }}' },
				},
			]
		}

		return {
			platform: 'template',
			lights: { [fixtureId]: templateLight },
		}
	}

	// No power: wrapper template, pass-through to group
	const groupEntityId = getUnderlyingLightTarget(fixtureId, fixture)

	const templateLight = {
		friendly_name: fixture.name,
		value_template: `{{ is_state('${groupEntityId}', 'on') }}`,
		turn_on: { service: 'light.turn_on', target: { entity_id: groupEntityId } },
		turn_off: { service: 'light.turn_off', target: { entity_id: groupEntityId } },
	}

	if (hasBrightness) {
		templateLight.level_template = `{{ state_attr('${groupEntityId}', 'brightness') | int }}`
		templateLight.set_level = {
			service: 'light.turn_on',
			target: { entity_id: groupEntityId },
			data: { brightness: '{{ brightness }}' },
		}
	}

	if (controls.includes('color_temp') && primaryDimmable) {
		templateLight.temperature_template = `{{ state_attr('${groupEntityId}', 'color_temp') }}`
		templateLight.set_temperature = {
			service: 'light.turn_on',
			target: { entity_id: groupEntityId },
			data: { color_temp: '{{ color_temp }}' },
		}
	}

	return {
		platform: 'template',
		lights: { [fixtureId]: templateLight },
	}
}

/**
 * Get light entities from a fixture (entities with entity_id starting with 'light.')
 * @param {import('../types/config.d.ts').SyncedFixture} fixture
 * @returns {import('../types/config.d.ts').SyncedEntity[]}
 */
export function getLightEntities(fixture) {
	return /** @type {import('../types/config.d.ts').SyncedEntity[]} */ (
		fixture.entities.filter(e => 'entity_id' in e && e.entity_id.startsWith('light.'))
	)
}

/**
 * Generate a light group for fixture bulbs.
 * Always creates a group (even for single bulb) so sync automation can use the group entity.
 * @param {string} fixtureId
 * @param {import('../types/config.d.ts').SyncedFixture} fixture
 * @returns {object[] | null}
 */
export function generateLightGroup(fixtureId, fixture) {
	const lightEntities = getLightEntities(fixture)
	if (lightEntities.length === 0) return null

	// Always create group - sync automation triggers on group, not individual bulbs
	return [{
		platform: 'group',
		name: `${fixtureId}_group`,
		unique_id: `${fixtureId}_group`,
		entities: lightEntities.map(e => e.entity_id),
	}]
}

/**
 * Generate blueprint automation for a device
 * @param {string} fixtureId
 * @param {import('../types/config.d.ts').SyncedFixture} fixture
 * @param {import('../types/config.d.ts').SyncedDevice} device
 * @param {number} deviceIndex
 * @returns {object}
 */
function generateBlueprintAutomation(fixtureId, fixture, device, deviceIndex) {
	const blueprint = /** @type {import('../types/config.d.ts').BlueprintConfig} */ (device.blueprint)

	// Use device name if provided, otherwise fall back to index
	const hasName = 'name' in device && device.name
	const suffix = hasName ? `_${device.name}` : (deviceIndex > 0 ? `_${deviceIndex}` : '')
	const aliasName = hasName ? device.name : (deviceIndex > 0 ? `Remote ${deviceIndex + 1}` : 'Remote')

	return {
		id: `${fixtureId}_remote${suffix}`,
		alias: `${fixture.name} ${aliasName}`,
		use_blueprint: {
			path: blueprint.path,
			input: {
				controller_device: device.device_id,
				...blueprint.input,
			},
		},
	}
}

/**
 * Generate unified automation for fixture sync and remote control
 * Handles entity state sync and remote device triggers in one automation
 * @param {string} fixtureId
 * @param {import('../types/config.d.ts').SyncedFixture} fixture
 * @returns {object[] | null}
 */
export function generateSyncAutomation(fixtureId, fixture) {
	const syncEntities = getSyncEntities(fixture)
	const deviceEntities = getDeviceEntities(fixture)
	const hasSyncEntities = syncEntities.length >= 2

	// Separate devices by control type
	const blueprintDevices = getBlueprintDevices(deviceEntities)
	const dimDevices = getDimDevices(deviceEntities)
	const onOffDevices = getOnOffDevices(deviceEntities)

	// Devices that need generator-built triggers (dim + on/off only)
	const generatorDevices = [...dimDevices, ...onOffDevices]
	const hasGeneratorDevices = generatorDevices.length > 0

	if (!hasSyncEntities && !hasGeneratorDevices && blueprintDevices.length === 0) return null

	const dashboardEntity = getDashboardEntity(fixtureId, fixture)
	const dimmables = getDimmableEntities(fixture)
	const hasDimmable = dimmables.length > 0

	const automations = []

	// Generate blueprint automations first
	blueprintDevices.forEach((device, idx) => {
		automations.push(generateBlueprintAutomation(fixtureId, fixture, device, idx))
	})

	// Only generate sync automation if there are sync entities or generator devices
	if (hasSyncEntities || hasGeneratorDevices) {
		const triggers = []
		const choices = []

		// Entity state sync triggers - use group for lights, direct IDs for non-lights
		if (hasSyncEntities) {
			const groupEntityId = `light.${fixtureId}_group`
			const nonLightSyncEntities = syncEntities.filter(e => !e.entity_id.startsWith('light.'))
			const syncTriggerIds = [groupEntityId, ...nonLightSyncEntities.map(e => e.entity_id)]

			triggers.push({
				platform: 'state',
				entity_id: syncTriggerIds,
				to: ['on', 'off'],
				id: 'entity_sync',
			})

			choices.push({
				conditions: [
					{ condition: 'trigger', id: 'entity_sync' },
					{ condition: 'template', value_template: '{{ trigger.to_state.state != trigger.from_state.state }}' },
				],
				sequence: [{
					service: 'homeassistant.turn_{{ trigger.to_state.state }}',
					target: {
						entity_id: `{% set triggered = trigger.entity_id %}\n{% set target_state = trigger.to_state.state %}\n{% set all = ${JSON.stringify(syncTriggerIds)} %}\n{{ all | reject('eq', triggered) | reject('is_state', target_state) | list }}`,
					},
				}],
			})
		}

		// Device triggers for generator-built devices (dim and on/off)
		const dimStyle = dimDevices[0]?.dim?.style || 'step'
		const stepPercent = dimDevices[0]?.dim?.step_percent || 10

		for (const device of generatorDevices) {
			// On/Off triggers for all generator devices
			triggers.push(
				{ domain: 'mqtt', device_id: device.device_id, type: 'action', subtype: 'on', trigger: 'device', id: 'device_on' },
				{ domain: 'mqtt', device_id: device.device_id, type: 'action', subtype: 'off', trigger: 'device', id: 'device_off' },
			)

			// Brightness triggers only for dim devices in step mode
			const hasDim = 'dim' in device && device.dim
			if (hasDimmable && hasDim && dimStyle === 'step') {
				triggers.push(
					{ domain: 'mqtt', device_id: device.device_id, type: 'action', subtype: 'brightness_move_up', trigger: 'device', id: 'brightness_up' },
					{ domain: 'mqtt', device_id: device.device_id, type: 'action', subtype: 'brightness_move_down', trigger: 'device', id: 'brightness_down' },
				)
			}
		}

		// Device on/off actions
		if (hasGeneratorDevices) {
			choices.push(
				{
					conditions: [{ condition: 'trigger', id: 'device_on' }],
					sequence: [{ service: 'homeassistant.turn_on', target: { entity_id: dashboardEntity.toggle_entity } }],
				},
				{
					conditions: [{ condition: 'trigger', id: 'device_off' }],
					sequence: [{ service: 'homeassistant.turn_off', target: { entity_id: dashboardEntity.toggle_entity } }],
				},
			)

			// Step dimming actions (hold mode handled by separate automation)
			if (hasDimmable && dimDevices.length > 0 && dimStyle === 'step') {
				choices.push(
					{
						conditions: [{ condition: 'trigger', id: 'brightness_up' }],
						sequence: [{ service: 'light.turn_on', target: { entity_id: dashboardEntity.entity_id }, data: { brightness_step_pct: stepPercent } }],
					},
					{
						conditions: [{ condition: 'trigger', id: 'brightness_down' }],
						sequence: [{ service: 'light.turn_on', target: { entity_id: dashboardEntity.entity_id }, data: { brightness_step_pct: -stepPercent } }],
					},
				)
			}
		}

		// Only add sync automation if it has triggers
		if (triggers.length > 0) {
			automations.push({
				id: `${fixtureId}_sync`,
				alias: `${fixture.name} Sync`,
				mode: 'restart',
				trigger: triggers,
				action: [{ choose: choices }],
			})
		}

		// Generate separate hold dimming automation if needed
		if (hasDimmable && dimDevices.length > 0 && dimStyle === 'hold') {
			const holdAutomation = generateHoldDimAutomation(fixtureId, fixture, dimDevices, dashboardEntity)
			if (holdAutomation) automations.push(holdAutomation)
		}
	}

	return automations.length > 0 ? automations : null
}

/**
 * Generate hold dimming automation with repeat loop
 * Separate automation with mode: restart so brightness_stop can interrupt
 * @param {string} fixtureId
 * @param {import('../types/config.d.ts').SyncedFixture} fixture
 * @param {import('../types/config.d.ts').SyncedDevice[]} dimDevices - Devices with dim config
 * @param {{ entity_id: string, toggle_entity: string, dimmable: boolean }} dashboardEntity
 * @returns {object}
 */
function generateHoldDimAutomation(fixtureId, fixture, dimDevices, dashboardEntity) {
	const stepPercent = dimDevices[0]?.dim?.step_percent || 5
	const triggers = []

	for (const device of dimDevices) {
		triggers.push(
			{ domain: 'mqtt', device_id: device.device_id, type: 'action', subtype: 'brightness_move_up', trigger: 'device', id: 'brightness_up' },
			{ domain: 'mqtt', device_id: device.device_id, type: 'action', subtype: 'brightness_move_down', trigger: 'device', id: 'brightness_down' },
			{ domain: 'mqtt', device_id: device.device_id, type: 'action', subtype: 'brightness_stop', trigger: 'device', id: 'brightness_stop' },
		)
	}

	return {
		id: `${fixtureId}_dim`,
		alias: `${fixture.name} Dim`,
		mode: 'restart',
		trigger: triggers,
		action: [{
			choose: [
				{
					conditions: [{ condition: 'trigger', id: 'brightness_up' }],
					sequence: [{
						repeat: {
							while: [{ condition: 'state', entity_id: dashboardEntity.entity_id, state: 'on' }],
							sequence: [
								{ service: 'light.turn_on', target: { entity_id: dashboardEntity.entity_id }, data: { brightness_step_pct: stepPercent } },
								{ delay: { milliseconds: 200 } },
							],
						},
					}],
				},
				{
					conditions: [{ condition: 'trigger', id: 'brightness_down' }],
					sequence: [{
						repeat: {
							while: [{ condition: 'state', entity_id: dashboardEntity.entity_id, state: 'on' }],
							sequence: [
								{ service: 'light.turn_on', target: { entity_id: dashboardEntity.entity_id }, data: { brightness_step_pct: -stepPercent } },
								{ delay: { milliseconds: 200 } },
							],
						},
					}],
				},
				{
					conditions: [{ condition: 'trigger', id: 'brightness_stop' }],
					sequence: [], // Empty - just stops the repeat loop via mode: restart
				},
			],
		}],
	}
}

/**
 * Process all synced entities for an area and return YAML structures
 * @param {Record<string, import('../types/config.d.ts').SyncedFixture>} syncedEntities
 * @returns {{ templateLights: object[], lightGroups: object[], automations: object[], inputNumbers: object, scripts: object }}
 */
export function processSyncedEntities(syncedEntities) {
	const templateLights = []
	const lightGroups = []
	const automations = []
	let inputNumbers = {}
	let scripts = {}

	for (const [fixtureId, fixture] of Object.entries(syncedEntities)) {
		// Generate brightness helper (if power entity + dimmable)
		const brightnessHelper = generateBrightnessHelper(fixtureId, fixture)
		if (brightnessHelper) inputNumbers = { ...inputNumbers, ...brightnessHelper }

		// Generate event throttler script (if power entity + dimmable)
		const throttlerScript = generateEventThrottlerScript(fixtureId, fixture)
		if (throttlerScript) scripts = { ...scripts, ...throttlerScript }

		// Generate template light (if power entity set) - legacy platform format
		const templateLight = generateTemplateLight(fixtureId, fixture)
		if (templateLight) templateLights.push(templateLight)

		// Generate light group (if power null + multiple dimmables)
		const lightGroup = generateLightGroup(fixtureId, fixture)
		if (lightGroup) lightGroups.push(...lightGroup)

		// Generate sync automation(s) - may include separate hold dim automation
		const fixtureAutomations = generateSyncAutomation(fixtureId, fixture)
		if (fixtureAutomations) automations.push(...fixtureAutomations)
	}

	return { templateLights, lightGroups, automations, inputNumbers, scripts }
}

/**
 * Get all entity IDs from synced entities that should be excluded from normal light lists
 * Only includes entities with entity_id (not remotes with device_id)
 * @param {Record<string, import('../types/config.d.ts').SyncedFixture>} syncedEntities
 * @returns {Set<string>}
 */
export function getSyncedEntityIds(syncedEntities) {
	const ids = new Set()

	for (const fixture of Object.values(syncedEntities)) {
		for (const entity of fixture.entities) {
			if ('entity_id' in entity) ids.add(entity.entity_id)
		}
	}

	return ids
}

/**
 * Get entity IDs of generated light groups.
 * Groups are always generated for fixtures with light entities.
 * Used so area package can exclude these internal entities from the area group (template wraps them).
 * @param {Record<string, import('../types/config.d.ts').SyncedFixture>} syncedEntities
 * @returns {string[]}
 */
export function getGeneratedGroupEntityIds(syncedEntities) {
	const ids = []

	for (const [fixtureId, fixture] of Object.entries(syncedEntities || {})) {
		const lightEntities = getLightEntities(fixture)
		if (lightEntities.length > 0) ids.push(`light.${fixtureId}_group`)
	}

	return ids
}

/**
 * Get entity IDs of template lights (light.${fixtureId}) for all synced fixtures.
 * Used so area light groups include the template as the target entity for each fixture.
 * @param {Record<string, import('../types/config.d.ts').SyncedFixture>} syncedEntities
 * @returns {string[]}
 */
export function getWrapperEntityIds(syncedEntities) {
	if (!syncedEntities) return []
	return Object.keys(syncedEntities).map(fixtureId => `light.${fixtureId}`)
}
