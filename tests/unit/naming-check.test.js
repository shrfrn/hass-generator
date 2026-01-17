// @ts-check
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { checkNamingConsistency, buildNamingReport } from '../../src/validation/naming-check.js'
import minimalInventory from '../fixtures/minimal-inventory.json'

// Suppress console.log during tests
beforeEach(() => {
	vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('naming-check.js', () => {

	describe('checkNamingConsistency', () => {

		test('returns prefixes map and violations array', () => {
			const result = checkNamingConsistency(minimalInventory)

			expect(result).toHaveProperty('prefixes')
			expect(result).toHaveProperty('violations')
			expect(result.prefixes instanceof Map).toBe(true)
			expect(Array.isArray(result.violations)).toBe(true)
		})

		test('returns empty results for inventory with no area-assigned entities', () => {
			const inventoryNoAreas = {
				entities: [
					{ entity_id: 'light.test', area_id: null },
				],
			}

			const result = checkNamingConsistency(inventoryNoAreas)

			expect(result.prefixes.size).toBe(0)
			expect(result.violations.length).toBe(0)
		})
	})

	describe('establishAreaPrefixes', () => {

		test('determines most common prefix per area', () => {
			const result = checkNamingConsistency(minimalInventory)

			expect(result.prefixes.get('living_room')).toBe('lr_')
			expect(result.prefixes.get('bedroom')).toBe('mb_')
			expect(result.prefixes.get('kitchen')).toBe('kt_')
		})

		test('handles areas with single entity', () => {
			const inventory = {
				entities: [
					{ entity_id: 'light.test_ceiling', area_id: 'test_area' },
				],
			}

			const result = checkNamingConsistency(inventory)

			expect(result.prefixes.get('test_area')).toBe('test_')
		})

		test('selects prefix with highest count when multiple exist', () => {
			const inventory = {
				entities: [
					{ entity_id: 'light.lr_one', area_id: 'mixed' },
					{ entity_id: 'light.lr_two', area_id: 'mixed' },
					{ entity_id: 'light.lr_three', area_id: 'mixed' },
					{ entity_id: 'light.mb_one', area_id: 'mixed' },
				],
			}

			const result = checkNamingConsistency(inventory)

			expect(result.prefixes.get('mixed')).toBe('lr_')
		})
	})

	describe('findViolations', () => {

		test('identifies entities with wrong prefix', () => {
			const inventory = {
				entities: [
					{ entity_id: 'light.lr_ceiling', area_id: 'living_room' },
					{ entity_id: 'light.lr_wall', area_id: 'living_room' },
					{ entity_id: 'light.wrong_prefix', area_id: 'living_room' },
				],
			}

			const result = checkNamingConsistency(inventory)

			expect(result.violations.length).toBe(1)
			expect(result.violations[0].entity_id).toBe('light.wrong_prefix')
			expect(result.violations[0].expected_prefix).toBe('lr_')
			expect(result.violations[0].actual_prefix).toBe('wrong_')
		})

		test('identifies entities with no prefix', () => {
			const inventory = {
				entities: [
					{ entity_id: 'light.lr_ceiling', area_id: 'living_room' },
					{ entity_id: 'light.lr_wall', area_id: 'living_room' },
					{ entity_id: 'light.noprefix', area_id: 'living_room' },
				],
			}

			const result = checkNamingConsistency(inventory)

			expect(result.violations.length).toBe(1)
			expect(result.violations[0].entity_id).toBe('light.noprefix')
			expect(result.violations[0].actual_prefix).toBe('(no prefix)')
		})

		test('returns empty violations when all entities follow conventions', () => {
			const inventory = {
				entities: [
					{ entity_id: 'light.lr_ceiling', area_id: 'living_room' },
					{ entity_id: 'light.lr_wall', area_id: 'living_room' },
					{ entity_id: 'light.lr_floor', area_id: 'living_room' },
				],
			}

			const result = checkNamingConsistency(inventory)

			expect(result.violations.length).toBe(0)
		})

		test('violations include area_id for grouping', () => {
			const inventory = {
				entities: [
					{ entity_id: 'light.lr_one', area_id: 'living_room' },
					{ entity_id: 'light.lr_two', area_id: 'living_room' },
					{ entity_id: 'light.wrong_bad', area_id: 'living_room' },
				],
			}

			const result = checkNamingConsistency(inventory)

			expect(result.violations[0].area_id).toBe('living_room')
		})
	})

	describe('buildNamingReport', () => {

		test('includes summary with counts', () => {
			const inventory = {
				entities: [
					{ entity_id: 'light.lr_ceiling', area_id: 'living_room' },
					{ entity_id: 'light.wrong_one', area_id: 'living_room' },
				],
			}

			const results = checkNamingConsistency(inventory)
			const report = buildNamingReport(results)

			expect(report.summary).toHaveProperty('total_areas_checked')
			expect(report.summary).toHaveProperty('areas_with_violations')
			expect(report.summary).toHaveProperty('total_violations')
		})

		test('includes generated_at timestamp', () => {
			const results = checkNamingConsistency(minimalInventory)
			const report = buildNamingReport(results)

			expect(report).toHaveProperty('generated_at')
			expect(typeof report.generated_at).toBe('string')
		})

		test('converts prefixes Map to object', () => {
			const results = checkNamingConsistency(minimalInventory)
			const report = buildNamingReport(results)

			expect(report.area_prefixes).toBeTypeOf('object')
			expect(report.area_prefixes.living_room).toBe('lr_')
		})

		test('includes violations array', () => {
			const inventory = {
				entities: [
					{ entity_id: 'light.lr_ceiling', area_id: 'living_room' },
					{ entity_id: 'light.wrong_one', area_id: 'living_room' },
				],
			}

			const results = checkNamingConsistency(inventory)
			const report = buildNamingReport(results)

			expect(Array.isArray(report.violations)).toBe(true)
			expect(report.violations.length).toBe(1)
		})
	})
})
