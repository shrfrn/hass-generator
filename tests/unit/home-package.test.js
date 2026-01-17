// @ts-check
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { generateHomePackage } from '../../src/generators/home-package.js'
import minimalInventory from '../fixtures/minimal-inventory.json'
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'

// Suppress console.log during tests
beforeEach(() => {
	vi.spyOn(console, 'log').mockImplementation(() => {})
})

const TEST_DIR = '/tmp/hass-gen-home-test'

describe('home-package.js', () => {

	beforeEach(() => {
		if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
		mkdirSync(TEST_DIR, { recursive: true })
	})

	describe('generateHomePackage', () => {

		test('creates home.yaml file', async () => {
			const files = await generateHomePackage(minimalInventory, TEST_DIR)

			expect(files).toEqual(['home.yaml'])
			expect(existsSync(join(TEST_DIR, 'home.yaml'))).toBe(true)
		})

		test('generates per-person binary sensors', async () => {
			await generateHomePackage(minimalInventory, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'home.yaml'), 'utf8')
			expect(content).toContain('name: John Home')
			expect(content).toContain('name: Jane Home')
		})

		test('per-person sensors reference correct entity', async () => {
			await generateHomePackage(minimalInventory, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'home.yaml'), 'utf8')
			expect(content).toContain("is_state('person.john', 'home')")
			expect(content).toContain("is_state('person.jane', 'home')")
		})

		test('generates anyone_home aggregate sensor', async () => {
			await generateHomePackage(minimalInventory, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'home.yaml'), 'utf8')
			expect(content).toContain('name: Anyone Home')
			expect(content).toContain('unique_id: anyone_home')
		})

		test('generates everyone_home aggregate sensor', async () => {
			await generateHomePackage(minimalInventory, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'home.yaml'), 'utf8')
			expect(content).toContain('name: Everyone Home')
			expect(content).toContain('unique_id: everyone_home')
		})

		test('generates people_home_count sensor', async () => {
			await generateHomePackage(minimalInventory, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'home.yaml'), 'utf8')
			expect(content).toContain('name: People Home Count')
			expect(content).toContain('unique_id: people_home_count')
		})

		test('generates home_became_occupied trigger sensor', async () => {
			await generateHomePackage(minimalInventory, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'home.yaml'), 'utf8')
			expect(content).toContain('name: Home Became Occupied')
			expect(content).toContain('unique_id: home_became_occupied')
		})

		test('generates home_became_empty trigger sensor', async () => {
			await generateHomePackage(minimalInventory, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'home.yaml'), 'utf8')
			expect(content).toContain('name: Home Became Empty')
			expect(content).toContain('unique_id: home_became_empty')
		})

		test('trigger sensors use binary_sensor.anyone_home', async () => {
			await generateHomePackage(minimalInventory, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'home.yaml'), 'utf8')
			expect(content).toContain('entity_id: binary_sensor.anyone_home')
		})

		test('per-person sensors have device_class presence', async () => {
			await generateHomePackage(minimalInventory, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'home.yaml'), 'utf8')
			expect(content).toContain('device_class: presence')
		})

		test('extracts first name for sensor naming', async () => {
			await generateHomePackage(minimalInventory, TEST_DIR)

			const content = readFileSync(join(TEST_DIR, 'home.yaml'), 'utf8')
			// John Doe -> john_home
			expect(content).toContain('unique_id: john_home')
			// Jane Doe -> jane_home
			expect(content).toContain('unique_id: jane_home')
		})
	})
})
