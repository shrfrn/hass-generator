// @ts-check
import { describe, test, expect } from 'vitest'
import { serializeToYaml, generateHeader, generateLabelHeader } from '../../src/generators/yaml-utils.js'

describe('yaml-utils.js', () => {

  describe('serializeToYaml', () => {

    test('serializes simple key-value pairs', () => {
      const obj = { name: 'Test', value: 123 }
      const result = serializeToYaml(obj)

      expect(result).toContain('name: Test')
      expect(result).toContain('value: 123')
    })

    test('serializes nested objects', () => {
      const obj = {
        group: {
          test_lights: {
            name: 'Test Lights',
          },
        },
      }
      const result = serializeToYaml(obj)

      expect(result).toContain('group:')
      expect(result).toContain('test_lights:')
      expect(result).toContain('name: Test Lights')
    })

    test('serializes arrays of strings', () => {
      const obj = {
        entities: ['light.one', 'light.two', 'light.three'],
      }
      const result = serializeToYaml(obj)

      expect(result).toContain('entities:')
      expect(result).toContain('- light.one')
      expect(result).toContain('- light.two')
      expect(result).toContain('- light.three')
    })

    test('serializes arrays of objects', () => {
      const obj = {
        triggers: [
          { platform: 'state', entity_id: 'light.test' },
          { platform: 'time', at: '10:00:00' },
        ],
      }
      const result = serializeToYaml(obj)

      expect(result).toContain('triggers:')
      expect(result).toContain('- platform: state')
      expect(result).toContain('entity_id: light.test')
      expect(result).toContain('- platform: time')
    })

    test('handles boolean values', () => {
      const obj = { has_date: true, has_time: false }
      const result = serializeToYaml(obj)

      expect(result).toContain('has_date: true')
      expect(result).toContain('has_time: false')
    })

    test('skips null and undefined values', () => {
      const obj = { name: 'Test', empty: null, missing: undefined }
      const result = serializeToYaml(obj)

      expect(result).toContain('name: Test')
      expect(result).not.toContain('empty:')
      expect(result).not.toContain('missing:')
    })

    test('adds section spacing for top-level keys when enabled', () => {
      const obj = { group: {}, input_select: {} }
      const result = serializeToYaml(obj, 0, true)

      // Should have a blank line between sections
      expect(result).toContain('group:\n\ninput_select:')
    })

    test('correct indentation for nested structures', () => {
      const obj = {
        level1: {
          level2: {
            level3: 'value',
          },
        },
      }
      const result = serializeToYaml(obj)

      expect(result).toContain('level1:\n')
      expect(result).toContain('  level2:\n')
      expect(result).toContain('    level3: value')
    })
  })

  describe('needsQuoting (via formatYamlString)', () => {

    test('quotes empty strings', () => {
      const obj = { name: '' }
      const result = serializeToYaml(obj)

      expect(result).toContain('name: ""')
    })

    test('quotes boolean-like strings (true/false)', () => {
      const obj = { state: 'true', other: 'false' }
      const result = serializeToYaml(obj)

      expect(result).toContain('state: "true"')
      expect(result).toContain('other: "false"')
    })

    test('quotes null/none strings', () => {
      const obj = { value: 'null', other: 'none' }
      const result = serializeToYaml(obj)

      expect(result).toContain('value: "null"')
      expect(result).toContain('other: "none"')
    })

    test('quotes on/off strings', () => {
      const obj = { state: 'on', other: 'off' }
      const result = serializeToYaml(obj)

      expect(result).toContain('state: "on"')
      expect(result).toContain('other: "off"')
    })

    test('quotes yes/no strings', () => {
      const obj = { answer: 'yes', other: 'no' }
      const result = serializeToYaml(obj)

      expect(result).toContain('answer: "yes"')
      expect(result).toContain('other: "no"')
    })

    test('quotes strings starting with numbers', () => {
      const obj = { code: '123abc' }
      const result = serializeToYaml(obj)

      expect(result).toContain('code: "123abc"')
    })

    test('quotes strings with colons', () => {
      const obj = { time: '10:30:00' }
      const result = serializeToYaml(obj)

      expect(result).toContain('time: "10:30:00"')
    })

    test('quotes strings with special chars', () => {
      const obj = { icon: 'mdi:pause-circle' }
      const result = serializeToYaml(obj)

      expect(result).toContain('icon: "mdi:pause-circle"')
    })

    test('does not quote regular strings', () => {
      const obj = { name: 'Living Room Lights' }
      const result = serializeToYaml(obj)

      expect(result).toContain('name: Living Room Lights')
      expect(result).not.toContain('"Living Room Lights"')
    })
  })

  describe('generateHeader', () => {

    test('includes area name and prefix', () => {
      const header = generateHeader('Living Room', 'lr_')

      expect(header).toContain('Area: Living Room (lr_)')
    })

    test('includes included entities when provided', () => {
      const header = generateHeader('Living Room', 'lr_', {
        included: ['switch.lr_fan'],
        excluded: [],
      })

      expect(header).toContain('Included in light group:')
      expect(header).toContain('+ switch.lr_fan')
    })

    test('includes excluded entities when provided', () => {
      const header = generateHeader('Living Room', 'lr_', {
        included: [],
        excluded: ['light.lr_accent'],
      })

      expect(header).toContain('Excluded from light group:')
      expect(header).toContain('- light.lr_accent')
    })

    test('includes auto-generated notice', () => {
      const header = generateHeader('Test', 't_')

      expect(header).toContain('Auto-generated by hass-data-generator')
      expect(header).toContain('Do not edit manually')
    })
  })

  describe('generateLabelHeader', () => {

    test('includes label name', () => {
      const header = generateLabelHeader('Outdoor')

      expect(header).toContain('Label: Outdoor')
    })

    test('includes auto-generated notice', () => {
      const header = generateLabelHeader('Test')

      expect(header).toContain('Auto-generated by hass-data-generator')
    })
  })
})
