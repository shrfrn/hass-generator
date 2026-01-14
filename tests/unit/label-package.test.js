// @ts-check
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { generateLabelPackages } from '../../src/generators/label-package.js'
import minimalInventory from '../fixtures/minimal-inventory.json'
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'

// Suppress console.log during tests
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

const TEST_DIR = '/tmp/hass-gen-label-test'

describe('label-package.js', () => {

  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
    mkdirSync(join(TEST_DIR, 'labels'), { recursive: true })
  })

  describe('generateLabelPackages', () => {

    test('creates files for labels with lights', async () => {
      const files = await generateLabelPackages(minimalInventory, TEST_DIR)

      expect(files.length).toBeGreaterThan(0)
    })

    test('creates label_outdoor file', async () => {
      const files = await generateLabelPackages(minimalInventory, TEST_DIR)

      expect(files.some(f => f.includes('label_outdoor'))).toBe(true)
    })

    test('creates label_flood_light file', async () => {
      const files = await generateLabelPackages(minimalInventory, TEST_DIR)

      expect(files.some(f => f.includes('label_flood_light'))).toBe(true)
    })

    test('skips labels with no light entities', async () => {
      const inventoryNoLights = {
        ...minimalInventory,
        labels: [{ id: 'test_label', name: 'Test Label' }],
        entities: minimalInventory.entities.map(e => ({
          ...e,
          labels: [], // Remove all label associations
        })),
      }

      const files = await generateLabelPackages(inventoryNoLights, TEST_DIR)

      expect(files).toEqual([])
    })

    test('returns empty array when no labels defined', async () => {
      const inventoryNoLabels = {
        ...minimalInventory,
        labels: [],
      }

      const files = await generateLabelPackages(inventoryNoLabels, TEST_DIR)

      expect(files).toEqual([])
    })
  })

  describe('getLabelLights', () => {

    test('includes only light domain entities', async () => {
      await generateLabelPackages(minimalInventory, TEST_DIR)

      const content = readFileSync(join(TEST_DIR, 'labels/label_outdoor.yaml'), 'utf8')
      // Should include lights with outdoor label
      expect(content).toContain('light.lr_outdoor')
      expect(content).toContain('light.ptio_flood')
      expect(content).toContain('light.ptio_path')
    })

    test('excludes non-light entities with matching label', async () => {
      const inventoryWithSwitch = {
        ...minimalInventory,
        entities: [
          ...minimalInventory.entities,
          {
            entity_id: 'switch.outdoor_pump',
            domain: 'switch',
            name: 'Outdoor Pump',
            labels: ['outdoor'],
            area_id: null,
          },
        ],
      }

      await generateLabelPackages(inventoryWithSwitch, TEST_DIR)

      const content = readFileSync(join(TEST_DIR, 'labels/label_outdoor.yaml'), 'utf8')
      expect(content).not.toContain('switch.outdoor_pump')
    })
  })

  describe('buildLabelPackage', () => {

    test('creates group with correct name', async () => {
      await generateLabelPackages(minimalInventory, TEST_DIR)

      const content = readFileSync(join(TEST_DIR, 'labels/label_outdoor.yaml'), 'utf8')
      expect(content).toContain('name: Outdoor Lights')
    })

    test('creates group with label_X_lights ID', async () => {
      await generateLabelPackages(minimalInventory, TEST_DIR)

      const content = readFileSync(join(TEST_DIR, 'labels/label_outdoor.yaml'), 'utf8')
      expect(content).toContain('label_outdoor_lights:')
    })

    test('entities are sorted alphabetically', async () => {
      await generateLabelPackages(minimalInventory, TEST_DIR)

      const content = readFileSync(join(TEST_DIR, 'labels/label_outdoor.yaml'), 'utf8')
      const entitiesMatch = content.match(/entities:\n((?:\s+-[^\n]+\n?)+)/)

      expect(entitiesMatch).toBeTruthy()

      const entities = entitiesMatch[1].match(/- ([^\n]+)/g).map(m => m.replace('- ', ''))
      const sorted = [...entities].sort()
      expect(entities).toEqual(sorted)
    })
  })
})
