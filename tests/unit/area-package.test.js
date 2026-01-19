// @ts-check
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { generateAreaPackages } from '../../src/generators/area-package.js'
import minimalInventory from '../fixtures/minimal-inventory.json'
import generatorConfig from '../fixtures/generator-config.js'
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'

// Suppress console.log during tests
beforeEach(() => {
	vi.spyOn(console, 'log').mockImplementation(() => {})
})

const TEST_DIR = '/tmp/hass-gen-test'

describe('area-package.js', () => {

	beforeEach(() => {
		if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
		mkdirSync(join(TEST_DIR, 'areas'), { recursive: true })
	})

	describe('generateAreaPackages', () => {

		test('creates files for areas with prefixes', async () => {
			const files = await generateAreaPackages(minimalInventory, generatorConfig, TEST_DIR)

			expect(files.length).toBeGreaterThan(0)
			expect(files.some(f => f.includes('lr_'))).toBe(true)
			expect(files.some(f => f.includes('mb_'))).toBe(true)
		})

		test('skips areas without detectable prefix', async () => {
			const files = await generateAreaPackages(minimalInventory, generatorConfig, TEST_DIR)

			// empty_area has no entities, so no prefix
			expect(files.some(f => f.includes('empty_area'))).toBe(false)
		})

		test('creates yaml files in areas subdirectory', async () => {
			const files = await generateAreaPackages(minimalInventory, generatorConfig, TEST_DIR)

			for (const file of files) {
				expect(file.startsWith('areas/')).toBe(true)
				expect(file.endsWith('.yaml')).toBe(true)
			}
		})
	})

	describe('buildAreaPackage', () => {

		test('package contains light group', async () => {
			await generateAreaPackages(minimalInventory, generatorConfig, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'areas/lr_living_room.yaml'), 'utf8')
			expect(content).toContain('group:')
			expect(content).toContain('lr_lights:')
		})

		test('package contains input_select for scenes', async () => {
			await generateAreaPackages(minimalInventory, generatorConfig, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'areas/lr_living_room.yaml'), 'utf8')
			expect(content).toContain('input_select:')
			expect(content).toContain('lr_active_scene:')
		})

		test('package contains input_datetime for last presence', async () => {
			await generateAreaPackages(minimalInventory, generatorConfig, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'areas/lr_living_room.yaml'), 'utf8')
			expect(content).toContain('input_datetime:')
			expect(content).toContain('lr_last_presence:')
		})

		test('package contains input_boolean for pause automations', async () => {
			await generateAreaPackages(minimalInventory, generatorConfig, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'areas/lr_living_room.yaml'), 'utf8')
			expect(content).toContain('input_boolean:')
			expect(content).toContain('lr_pause_automations:')
		})

		test('package contains vacancy timer', async () => {
			await generateAreaPackages(minimalInventory, generatorConfig, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'areas/lr_living_room.yaml'), 'utf8')
			expect(content).toContain('timer:')
			expect(content).toContain('lr_vacancy:')
		})
	})

	describe('buildLightGroup', () => {

		test('includes lights from the area', async () => {
			await generateAreaPackages(minimalInventory, generatorConfig, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'areas/lr_living_room.yaml'), 'utf8')
			expect(content).toContain('light.lr_ceiling')
			expect(content).toContain('light.lr_wall')
		})

		test('include_in_group adds entities to light group', async () => {
			// generator-config.js has include_in_group: ['switch.lr_soc_e'] for living_room
			await generateAreaPackages(minimalInventory, generatorConfig, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'areas/lr_living_room.yaml'), 'utf8')
			expect(content).toContain('switch.lr_soc_e')
		})

		test('exclude_from_group removes entities from light group', async () => {
			// generator-config.js has exclude_from_group: ['light.lr_accent'] for living_room
			await generateAreaPackages(minimalInventory, generatorConfig, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'areas/lr_living_room.yaml'), 'utf8')
			// Extract just the entities section to check exclusion
			const entitiesMatch = content.match(/entities:\n((?:\s+-[^\n]+\n?)+)/)
			expect(entitiesMatch?.[1]).toBeDefined()
			expect(entitiesMatch?.[1]).not.toContain('light.lr_accent')
		})

		test('global excluded_labels excludes lights with matching label', async () => {
			// generator-config.js has excluded_labels: ['outdoor'] globally
			await generateAreaPackages(minimalInventory, generatorConfig, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'areas/lr_living_room.yaml'), 'utf8')
			// light.lr_outdoor has 'outdoor' label
			expect(content).not.toContain('light.lr_outdoor')
		})

		test('area included_labels overrides global excluded_labels', async () => {
			// generator-config.js has included_labels: ['outdoor'] for front_yard
			await generateAreaPackages(minimalInventory, generatorConfig, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'areas/ptio_front_yard.yaml'), 'utf8')
			// ptio lights have 'outdoor' label but area has included_labels: ['outdoor']
			expect(content).toContain('light.ptio_flood')
			expect(content).toContain('light.ptio_path')
		})

		test('area excluded_labels: [] clears global exclusions', async () => {
			const config = {
				excluded_labels: ['outdoor'],
				areas: {
					front_yard: {
						excluded_labels: [], // Clear global exclusions
					},
				},
			}
			await generateAreaPackages(minimalInventory, config, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'areas/ptio_front_yard.yaml'), 'utf8')
			expect(content).toContain('light.ptio_flood')
			expect(content).toContain('light.ptio_path')
		})

		test('area excluded_labels replaces (not merges with) global', async () => {
			const config = {
				excluded_labels: ['outdoor', 'flood_light'],
				areas: {
					front_yard: {
						excluded_labels: ['flood_light'], // Only exclude flood_light, not outdoor
					},
				},
			}
			await generateAreaPackages(minimalInventory, config, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'areas/ptio_front_yard.yaml'), 'utf8')
			// ptio_path has only 'outdoor' label - should be included since area only excludes flood_light
			expect(content).toContain('light.ptio_path')
			// ptio_flood has 'flood_light' label - should be excluded
			expect(content).not.toContain('light.ptio_flood')
		})

		test('syncedEntities excludes synced entities from light group', async () => {
			// generator-config.js has syncedEntities for bedroom
			await generateAreaPackages(minimalInventory, generatorConfig, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'areas/mb_bedroom.yaml'), 'utf8')
			// Synced entities should not be in the light group
			const groupSection = content.match(/group:[\s\S]*?(?=\n\w|$)/)?.[0] || ''
			expect(groupSection).not.toContain('light.mb_soc_bulb')
			expect(groupSection).not.toContain('switch.mb_soc')
			// light.mb_ceiling should still be there
			expect(groupSection).toContain('light.mb_ceiling')
		})

		test('syncedEntities generates sync automation', async () => {
			await generateAreaPackages(minimalInventory, generatorConfig, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'areas/mb_bedroom.yaml'), 'utf8')
			expect(content).toContain('automation:')
			expect(content).toContain('sync_mb_standing_lamp')
			expect(content).toContain('switch.mb_soc')
			expect(content).toContain('light.mb_soc_bulb')
		})

		test('syncedEntities with power generates template light', async () => {
			const config = {
				areas: {
					bedroom: {
						syncedEntities: {
							mb_wall_light: {
								name: 'Bedroom Wall Light',
								power: 'light.mb_relay',
								entities: [
									{ entity_id: 'light.mb_relay', sync: true },
									{ entity_id: 'light.mb_bulb', sync: true, controls: 'dimmable' },
								],
							},
						},
					},
				},
			}
			await generateAreaPackages(minimalInventory, config, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'areas/mb_bedroom.yaml'), 'utf8')
			expect(content).toContain('platform: template')
			expect(content).toContain('friendly_name: Bedroom Wall Light')
			expect(content).toContain('wait_template')
		})
	})

	describe('vacancy_timer_duration', () => {

		test('uses global default_vacancy_duration', async () => {
			// generator-config.js has default_vacancy_duration: '00:10:00'
			await generateAreaPackages(minimalInventory, generatorConfig, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'areas/lr_living_room.yaml'), 'utf8')
			expect(content).toContain('duration: "00:10:00"')
		})

		test('area vacancy_timer_duration overrides global', async () => {
			// generator-config.js has vacancy_timer_duration: '00:05:00' for bedroom
			await generateAreaPackages(minimalInventory, generatorConfig, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'areas/mb_bedroom.yaml'), 'utf8')
			expect(content).toContain('duration: "00:05:00"')
		})

		test('defaults to 00:10:00 when no duration configured', async () => {
			const config = { areas: {} } // No default_vacancy_duration
			await generateAreaPackages(minimalInventory, config, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'areas/lr_living_room.yaml'), 'utf8')
			expect(content).toContain('duration: "00:10:00"')
		})
	})

	describe('scene selector', () => {

		test('includes area scenes in options', async () => {
			await generateAreaPackages(minimalInventory, generatorConfig, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'areas/lr_living_room.yaml'), 'utf8')
			expect(content).toContain('scene.lr_standard')
			expect(content).toContain('scene.lr_minimal')
		})

		test('includes none as first option', async () => {
			await generateAreaPackages(minimalInventory, generatorConfig, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'areas/lr_living_room.yaml'), 'utf8')
			expect(content).toContain('- "none"')
		})
	})
})
