// @ts-check
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { prepareAllAreaData } from '../../src/generators/dashboard/data.js'
import minimalInventory from '../fixtures/minimal-inventory.json'
import dashboardConfig from '../fixtures/dashboard-config.js'
import generatorConfig from '../fixtures/generator-config.js'

// Suppress console.log during tests
beforeEach(() => {
	vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('dashboard/data.js', () => {

	describe('prepareAllAreaData', () => {

		test('respects pinned_areas order', () => {
			const config = { pinned_areas: ['bedroom', 'living_room'] }
			const result = prepareAllAreaData(minimalInventory, config)
			const areaIds = result.map(r => r.area.id)

			expect(areaIds[0]).toBe('bedroom')
			expect(areaIds[1]).toBe('living_room')
		})

		test('sorts unpinned areas alphabetically by name', () => {
			const config = { pinned_areas: ['living_room'] }
			const result = prepareAllAreaData(minimalInventory, config)
			const areaIds = result.map(r => r.area.id)

			// living_room is pinned first, then others alphabetically
			expect(areaIds[0]).toBe('living_room')

			const unpinnedNames = result.slice(1).map(r => r.area.name)
			const sortedNames = [...unpinnedNames].sort((a, b) => a.localeCompare(b))
			expect(unpinnedNames).toEqual(sortedNames)
		})

		test('excludes areas in excluded_areas', () => {
			const config = { excluded_areas: ['bedroom', 'kitchen'] }
			const result = prepareAllAreaData(minimalInventory, config)
			const areaIds = result.map(r => r.area.id)

			expect(areaIds).not.toContain('bedroom')
			expect(areaIds).not.toContain('kitchen')
		})

		test('skips areas without detectable prefix', () => {
			const config = {}
			const result = prepareAllAreaData(minimalInventory, config)
			const areaIds = result.map(r => r.area.id)

			// empty_area has no entities, so no prefix
			expect(areaIds).not.toContain('empty_area')
		})

		test('extracts correct prefix from entities', () => {
			const config = {}
			const result = prepareAllAreaData(minimalInventory, config)
			const lr = result.find(r => r.area.id === 'living_room')

			expect(lr.prefix).toBe('lr_')
		})

		test('includes visibleToUsers from dashboard config', () => {
			const result = prepareAllAreaData(minimalInventory, dashboardConfig, generatorConfig)
			const bedroom = result.find(r => r.area.id === 'bedroom')

			expect(bedroom.visibleToUsers).toEqual(['user_parent_1', 'user_parent_2'])
		})

		test('sets visibleToUsers to null when not configured', () => {
			const result = prepareAllAreaData(minimalInventory, dashboardConfig, generatorConfig)
			const kitchen = result.find(r => r.area.id === 'kitchen')

			expect(kitchen.visibleToUsers).toBeNull()
		})
	})

	describe('buildLightsList', () => {

		test('excludes lights in excluded_lights', () => {
			const result = prepareAllAreaData(minimalInventory, dashboardConfig, generatorConfig)
			const lr = result.find(r => r.area.id === 'living_room')
			const lightIds = lr.lights.map(l => l.entity_id)

			expect(lightIds).not.toContain('light.lr_outdoor')
		})

		test('includes entities from included_lights', () => {
			const result = prepareAllAreaData(minimalInventory, dashboardConfig, generatorConfig)
			const lr = result.find(r => r.area.id === 'living_room')
			const lightIds = lr.lights.map(l => l.entity_id)

			expect(lightIds).toContain('switch.lr_soc_e')
		})

		test('excluded light appears in otherEntities', () => {
			const result = prepareAllAreaData(minimalInventory, dashboardConfig, generatorConfig)
			const lr = result.find(r => r.area.id === 'living_room')
			const otherIds = lr.otherEntities.map(e => e.entity_id)

			expect(otherIds).toContain('light.lr_outdoor')
		})

		test('synced entities are excluded from normal lights list', () => {
			const result = prepareAllAreaData(minimalInventory, dashboardConfig, generatorConfig)
			const bedroom = result.find(r => r.area.id === 'bedroom')
			const lightIds = bedroom.lights.map(l => l.entity_id)

			// Individual synced entities should not appear
			expect(lightIds).not.toContain('switch.mb_soc')
			// But the synced fixture dashboard entity should appear
			expect(lightIds).toContain('light.mb_soc_bulb')
		})

		test('synced fixture appears in lights with correct toggle entity', () => {
			const result = prepareAllAreaData(minimalInventory, dashboardConfig, generatorConfig)
			const bedroom = result.find(r => r.area.id === 'bedroom')
			const fixture = bedroom.lights.find(l => l.entity_id === 'light.mb_soc_bulb')

			expect(fixture).toBeDefined()
			expect(fixture.name).toBe('Master Bedroom Standing Lamp')
			expect(fixture.toggle_entity).toBe('switch.mb_soc')
			expect(fixture.dimmable).toBe(true)
			expect(fixture.is_synced_fixture).toBe(true)
		})
	})

	describe('enrichWithDimming', () => {

		test('light with brightness mode is dimmable', () => {
			const result = prepareAllAreaData(minimalInventory, {}, generatorConfig)
			const lr = result.find(r => r.area.id === 'living_room')
			const ceiling = lr.lights.find(l => l.entity_id === 'light.lr_ceiling')

			expect(ceiling.dimmable).toBe(true)
		})

		test('light with onoff mode only is not dimmable', () => {
			const result = prepareAllAreaData(minimalInventory, {}, generatorConfig)
			const lr = result.find(r => r.area.id === 'living_room')
			const wall = lr.lights.find(l => l.entity_id === 'light.lr_wall')

			expect(wall.dimmable).toBe(false)
		})

		test('synced fixture with dimmable bulb is marked dimmable', () => {
			const result = prepareAllAreaData(minimalInventory, dashboardConfig, generatorConfig)
			const bedroom = result.find(r => r.area.id === 'bedroom')
			const fixture = bedroom.lights.find(l => l.is_synced_fixture)

			expect(fixture.dimmable).toBe(true)
		})

		test('light with color modes has has_advanced_controls', () => {
			const result = prepareAllAreaData(minimalInventory, {}, generatorConfig)
			const lr = result.find(r => r.area.id === 'living_room')
			const accent = lr.lights.find(l => l.entity_id === 'light.lr_accent')

			expect(accent.has_advanced_controls).toBe(true)
		})

		test('light with brightness only does not have has_advanced_controls', () => {
			const result = prepareAllAreaData(minimalInventory, {}, generatorConfig)
			const lr = result.find(r => r.area.id === 'living_room')
			const ceiling = lr.lights.find(l => l.entity_id === 'light.lr_ceiling')

			expect(ceiling.has_advanced_controls).toBe(false)
		})
	})

	describe('buildScenesList', () => {

		test('excludes scenes in excluded_scenes', () => {
			const result = prepareAllAreaData(minimalInventory, dashboardConfig, generatorConfig)
			const lr = result.find(r => r.area.id === 'living_room')
			const sceneIds = lr.scenes.map(s => s.entity_id)

			expect(sceneIds).not.toContain('scene.lr_movie_mode')
		})

		test('includes scenes from included_scenes (cross-area)', () => {
			const result = prepareAllAreaData(minimalInventory, dashboardConfig, generatorConfig)
			const kitchen = result.find(r => r.area.id === 'kitchen')
			const sceneIds = kitchen.scenes.map(s => s.entity_id)

			expect(sceneIds).toContain('scene.lr_movie_mode')
		})

		test('excludes scenes with _template suffix', () => {
			const result = prepareAllAreaData(minimalInventory, {}, generatorConfig)
			const lr = result.find(r => r.area.id === 'living_room')
			const sceneIds = lr.scenes.map(s => s.entity_id)

			expect(sceneIds).not.toContain('scene.lr_template')
		})

		test('includes regular area scenes', () => {
			const result = prepareAllAreaData(minimalInventory, {}, generatorConfig)
			const lr = result.find(r => r.area.id === 'living_room')
			const sceneIds = lr.scenes.map(s => s.entity_id)

			expect(sceneIds).toContain('scene.lr_standard')
			expect(sceneIds).toContain('scene.lr_minimal')
		})
	})

	describe('findAcEntity', () => {

		test('finds climate entity ending with _ac', () => {
			const result = prepareAllAreaData(minimalInventory, {}, generatorConfig)
			const lr = result.find(r => r.area.id === 'living_room')

			expect(lr.acEntity).toBe('climate.lr_ac')
		})

		test('returns null when no AC found', () => {
			const result = prepareAllAreaData(minimalInventory, {}, generatorConfig)
			const kitchen = result.find(r => r.area.id === 'kitchen')

			expect(kitchen.acEntity).toBeNull()
		})
	})

	describe('findFanEntity', () => {

		test('finds fan domain entity', () => {
			const result = prepareAllAreaData(minimalInventory, {}, generatorConfig)
			const lr = result.find(r => r.area.id === 'living_room')

			expect(lr.fanEntity).toBe('fan.lr_ceiling_fan')
		})

		test('returns null when no fan found', () => {
			const result = prepareAllAreaData(minimalInventory, {}, generatorConfig)
			const bedroom = result.find(r => r.area.id === 'bedroom')

			expect(bedroom.fanEntity).toBeNull()
		})
	})

	describe('lightGroup', () => {

		test('generates correct light group entity_id', () => {
			const result = prepareAllAreaData(minimalInventory, {}, generatorConfig)
			const lr = result.find(r => r.area.id === 'living_room')

			expect(lr.lightGroup).toBe('group.lr_lights')
		})

		test('uses area prefix for light group', () => {
			const result = prepareAllAreaData(minimalInventory, {}, generatorConfig)
			const bedroom = result.find(r => r.area.id === 'bedroom')

			expect(bedroom.lightGroup).toBe('group.mb_lights')
		})
	})
})
