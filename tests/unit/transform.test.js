// @ts-check
import { describe, test, expect, vi } from 'vitest'
import { transformData } from '../../src/transform.js'
import rawHaData from '../fixtures/raw-ha-data.json'

// Mock the websocket module to avoid actual connection
vi.mock('../../src/websocket.js', () => ({
	getHaVersion: () => '2024.1.0',
}))

describe('transform.js', () => {

	describe('transformData', () => {

		test('returns correct top-level structure', () => {
			const result = transformData(rawHaData)

			expect(result).toHaveProperty('metadata')
			expect(result).toHaveProperty('floors')
			expect(result).toHaveProperty('areas')
			expect(result).toHaveProperty('devices')
			expect(result).toHaveProperty('labels')
			expect(result).toHaveProperty('entities')
			expect(result).toHaveProperty('scenes')
			expect(result).toHaveProperty('zones')
			expect(result).toHaveProperty('persons')
		})

		test('metadata contains generated_at and ha_version', () => {
			const result = transformData(rawHaData)

			expect(result.metadata).toHaveProperty('generated_at')
			expect(result.metadata).toHaveProperty('ha_version')
			expect(result.metadata.ha_version).toBe('2024.1.0')
			expect(typeof result.metadata.generated_at).toBe('string')
		})
	})

	describe('transformAreas', () => {

		test('maps area_id to id', () => {
			const result = transformData(rawHaData)
			const livingRoom = result.areas.find(a => a.id === 'living_room')

			expect(livingRoom).toBeDefined()
			expect(livingRoom.id).toBe('living_room')
			expect(livingRoom.name).toBe('Living Room')
		})

		test('preserves icon and floor_id', () => {
			const result = transformData(rawHaData)
			const livingRoom = result.areas.find(a => a.id === 'living_room')

			expect(livingRoom.icon).toBe('mdi:sofa')
			expect(livingRoom.floor_id).toBeNull()
		})

		test('includes aliases array', () => {
			const result = transformData(rawHaData)
			const livingRoom = result.areas.find(a => a.id === 'living_room')

			expect(Array.isArray(livingRoom.aliases)).toBe(true)
		})
	})

	describe('transformEntities', () => {

		test('extracts domain from entity_id', () => {
			const result = transformData(rawHaData)
			const light = result.entities.find(e => e.entity_id === 'light.lr_ceiling')

			expect(light.domain).toBe('light')
		})

		test('extracts domain for climate entities', () => {
			const result = transformData(rawHaData)
			const climate = result.entities.find(e => e.entity_id === 'climate.lr_ac')

			expect(climate.domain).toBe('climate')
		})

		test('resolves area_id directly from entity registry', () => {
			const result = transformData(rawHaData)
			// light.lr_wall has direct area_id in registry
			const wall = result.entities.find(e => e.entity_id === 'light.lr_wall')

			expect(wall.area_id).toBe('living_room')
		})

		test('inherits area_id from device when entity has no direct area', () => {
			const result = transformData(rawHaData)
			// light.lr_ceiling has no area_id but device_lr_ceiling has area_id
			const ceiling = result.entities.find(e => e.entity_id === 'light.lr_ceiling')

			expect(ceiling.area_id).toBe('living_room')
		})

		test('returns null area_id when no area can be resolved', () => {
			const result = transformData(rawHaData)
			// person entities have no area
			const person = result.entities.find(e => e.entity_id === 'person.john')

			expect(person.area_id).toBeNull()
		})

		test('prefers registry name over friendly_name', () => {
			const result = transformData(rawHaData)
			// light.lr_wall has name "Wall" in registry
			const wall = result.entities.find(e => e.entity_id === 'light.lr_wall')

			expect(wall.name).toBe('Wall')
		})

		test('falls back to friendly_name when no registry name', () => {
			const result = transformData(rawHaData)
			// person.john has no registry name
			const person = result.entities.find(e => e.entity_id === 'person.john')

			expect(person.name).toBe('John Doe')
		})

		test('includes labels from entity registry', () => {
			const result = transformData(rawHaData)
			const outdoor = result.entities.find(e => e.entity_id === 'light.lr_outdoor')

			expect(outdoor.labels).toContain('outdoor')
		})

		test('includes attributes from state', () => {
			const result = transformData(rawHaData)
			const ceiling = result.entities.find(e => e.entity_id === 'light.lr_ceiling')

			expect(ceiling.attributes).toHaveProperty('supported_color_modes')
			expect(ceiling.attributes.supported_color_modes).toContain('brightness')
		})
	})

	describe('extractScenes', () => {

		test('filters only scene domain entities', () => {
			const result = transformData(rawHaData)

			for (const scene of result.scenes) {
				expect(scene.entity_id).toMatch(/^scene\./)
			}
		})

		test('extracts name from friendly_name attribute', () => {
			const result = transformData(rawHaData)
			const standard = result.scenes.find(s => s.entity_id === 'scene.lr_standard')

			expect(standard.name).toBe('Standard')
		})

		test('includes icon from attributes', () => {
			const result = transformData(rawHaData)
			const scene = result.scenes[0]

			expect(scene).toHaveProperty('icon')
		})
	})

	describe('transformLabels', () => {

		test('maps label_id to id', () => {
			const result = transformData(rawHaData)
			const outdoor = result.labels.find(l => l.id === 'outdoor')

			expect(outdoor).toBeDefined()
			expect(outdoor.name).toBe('Outdoor')
		})
	})

	describe('transformPersons', () => {

		test('combines storage and config persons', () => {
			const result = transformData(rawHaData)

			expect(result.persons.length).toBeGreaterThan(0)
		})

		test('extracts person properties', () => {
			const result = transformData(rawHaData)
			const john = result.persons.find(p => p.id === 'john')

			expect(john).toBeDefined()
			expect(john.name).toBe('John Doe')
			expect(john.user_id).toBe('user_john')
		})
	})

	describe('transformDevices', () => {

		test('preserves device id and area_id', () => {
			const result = transformData(rawHaData)
			const device = result.devices.find(d => d.id === 'device_lr_ceiling')

			expect(device).toBeDefined()
			expect(device.area_id).toBe('living_room')
		})

		test('uses name or name_by_user', () => {
			const result = transformData(rawHaData)
			const device = result.devices.find(d => d.id === 'device_lr_ceiling')

			expect(device.name).toBe('Ceiling Light')
		})
	})
})
