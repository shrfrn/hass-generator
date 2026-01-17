// @ts-check
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render } from '../../src/generators/dashboard/templates/bubble/renderer.js'
import { wrapWithUserCondition, formatEntityName } from '../../src/generators/dashboard/shared.js'
import { prepareAllAreaData } from '../../src/generators/dashboard/data.js'
import minimalInventory from '../fixtures/minimal-inventory.json'
import dashboardConfig from '../fixtures/dashboard-config.js'
import generatorConfig from '../fixtures/generator-config.js'

// Suppress console.log during tests
beforeEach(() => {
	vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('bubble/renderer.js', () => {

	function getAreaData() {
		return prepareAllAreaData(minimalInventory, dashboardConfig, generatorConfig)
	}

	describe('render', () => {

		test('produces valid Lovelace structure with views', () => {
			const areaData = getAreaData()
			const result = render(areaData, dashboardConfig)

			expect(result).toHaveProperty('views')
			expect(Array.isArray(result.views)).toBe(true)
			expect(result.views.length).toBeGreaterThan(0)
		})

		test('views have title and sections', () => {
			const areaData = getAreaData()
			const result = render(areaData, dashboardConfig)
			const view = result.views[0]

			expect(view).toHaveProperty('title')
			expect(view).toHaveProperty('sections')
			expect(Array.isArray(view.sections)).toBe(true)
		})

		test('sections contain cards array', () => {
			const areaData = getAreaData()
			const result = render(areaData, dashboardConfig)
			const section = result.views[0].sections[0]

			expect(section).toHaveProperty('type', 'grid')
			expect(section).toHaveProperty('cards')
			expect(Array.isArray(section.cards)).toBe(true)
		})

		test('uses dashboard_name from config', () => {
			const areaData = getAreaData()
			const result = render(areaData, dashboardConfig)

			expect(result.views[0].title).toBe('Test')
		})

		test('defaults to Home when no dashboard_name', () => {
			const areaData = getAreaData()
			const result = render(areaData, {})

			expect(result.views[0].title).toBe('Home')
		})
	})

	describe('buildPreviewCard', () => {

		test('tap_action targets scene with default_scene_suffix', () => {
			const areaData = getAreaData()
			const result = render(areaData, dashboardConfig)

			// Find preview card for living_room (has lr_ prefix)
			const cards = result.views[0].sections[0].cards
			const lrPreview = cards.find(c =>
				c.tap_action?.target?.entity_id === 'scene.lr_standard' ||
        c.card?.tap_action?.target?.entity_id === 'scene.lr_standard',
			)

			expect(lrPreview).toBeDefined()

			const card = lrPreview.card || lrPreview
			expect(card.tap_action.target.entity_id).toBe('scene.lr_standard')
		})

		test('area with AC has sub_button for climate entity', () => {
			const areaData = getAreaData()
			const result = render(areaData, dashboardConfig)

			// Find living room preview card
			const cards = result.views[0].sections[0].cards
			const lrPreview = cards.find(c =>
				(c.entity === 'group.lr_lights') ||
        (c.card?.entity === 'group.lr_lights'),
			)

			expect(lrPreview).toBeDefined()

			const card = lrPreview.card || lrPreview
			expect(card.sub_button).toBeDefined()

			const acButton = card.sub_button.find(b => b.entity === 'climate.lr_ac')
			expect(acButton).toBeDefined()
			expect(acButton.icon).toBe('mdi:snowflake')
		})

		test('area with fan has sub_button for fan entity', () => {
			const areaData = getAreaData()
			const result = render(areaData, dashboardConfig)

			// Find living room preview card
			const cards = result.views[0].sections[0].cards
			const lrPreview = cards.find(c =>
				(c.entity === 'group.lr_lights') ||
        (c.card?.entity === 'group.lr_lights'),
			)

			expect(lrPreview).toBeDefined()

			const card = lrPreview.card || lrPreview
			const fanButton = card.sub_button.find(b => b.entity === 'fan.lr_ceiling_fan')
			expect(fanButton).toBeDefined()
			expect(fanButton.tap_action.action).toBe('toggle')
		})

		test('preview card has correct hold_action for toggle', () => {
			const areaData = getAreaData()
			const result = render(areaData, dashboardConfig)

			const cards = result.views[0].sections[0].cards
			const preview = cards.find(c =>
				(c.type === 'custom:bubble-card' && c.card_type === 'button') ||
        (c.card?.type === 'custom:bubble-card' && c.card?.card_type === 'button'),
			)

			expect(preview).toBeDefined()

			const card = preview.card || preview
			expect(card.hold_action).toEqual({ action: 'toggle' })
		})

		test('preview card navigates to popup on button_action tap', () => {
			const areaData = getAreaData()
			const result = render(areaData, dashboardConfig)

			const cards = result.views[0].sections[0].cards
			const lrPreview = cards.find(c =>
				(c.entity === 'group.lr_lights') ||
        (c.card?.entity === 'group.lr_lights'),
			)

			expect(lrPreview).toBeDefined()

			const card = lrPreview.card || lrPreview
			expect(card.button_action.tap_action.action).toBe('navigate')
			expect(card.button_action.tap_action.navigation_path).toBe('#lr_details')
		})
	})

	describe('buildLightCard', () => {

		test('dimmable light uses slider button_type', () => {
			const areaData = getAreaData()
			const result = render(areaData, dashboardConfig)

			// Find popup cards (vertical-stack type)
			const cards = result.views[0].sections[0].cards
			const popup = cards.find(c => c.type === 'vertical-stack' || c.card?.type === 'vertical-stack')

			expect(popup).toBeDefined()

			const stack = popup.card || popup

			// Find lights grid
			const lightsGrid = stack.cards.find(c =>
				c.type === 'grid' && c.cards?.some(card => card.entity?.startsWith('light.')),
			)

			expect(lightsGrid).toBeDefined()

			// Find a dimmable light (light.lr_ceiling has brightness mode)
			const ceilingCard = lightsGrid.cards.find(c => c.entity === 'light.lr_ceiling')
			expect(ceilingCard).toBeDefined()
			expect(ceilingCard.button_type).toBe('slider')
		})

		test('on/off only light uses switch button_type', () => {
			const areaData = getAreaData()
			const result = render(areaData, dashboardConfig)

			const cards = result.views[0].sections[0].cards
			const popup = cards.find(c => c.type === 'vertical-stack' || c.card?.type === 'vertical-stack')
			const stack = popup.card || popup
			const lightsGrid = stack.cards.find(c =>
				c.type === 'grid' && c.cards?.some(card => card.entity?.startsWith('light.')),
			)

			expect(lightsGrid).toBeDefined()

			// Find on/off only light (light.lr_wall has onoff mode only)
			const wallCard = lightsGrid.cards.find(c => c.entity === 'light.lr_wall')
			expect(wallCard).toBeDefined()
			expect(wallCard.button_type).toBe('switch')
		})

		test('light with color modes has double_tap_action for more-info', () => {
			const areaData = getAreaData()
			const result = render(areaData, dashboardConfig)

			const cards = result.views[0].sections[0].cards
			const popup = cards.find(c => c.type === 'vertical-stack' || c.card?.type === 'vertical-stack')
			const stack = popup.card || popup
			const lightsGrid = stack.cards.find(c =>
				c.type === 'grid' && c.cards?.some(card => card.entity?.startsWith('light.')),
			)

			expect(lightsGrid).toBeDefined()

			// Find accent light (has hs, color_temp modes)
			const accentCard = lightsGrid.cards.find(c => c.entity === 'light.lr_accent')
			expect(accentCard).toBeDefined()
			expect(accentCard.double_tap_action).toEqual({ action: 'more-info' })
		})

		test('light without advanced controls has no double_tap_action', () => {
			const areaData = getAreaData()
			const result = render(areaData, dashboardConfig)

			const cards = result.views[0].sections[0].cards
			const popup = cards.find(c => c.type === 'vertical-stack' || c.card?.type === 'vertical-stack')
			const stack = popup.card || popup
			const lightsGrid = stack.cards.find(c =>
				c.type === 'grid' && c.cards?.some(card => card.entity?.startsWith('light.')),
			)

			expect(lightsGrid).toBeDefined()

			// Find ceiling light (brightness only, no advanced)
			const ceilingCard = lightsGrid.cards.find(c => c.entity === 'light.lr_ceiling')
			expect(ceilingCard).toBeDefined()
			expect(ceilingCard.double_tap_action).toBeUndefined()
		})

		test('switch with companion bulb has entity pointing to bulb', () => {
			// Use config that includes the switch in lights
			const config = {
				...dashboardConfig,
				areas: {
					bedroom: {
						included_lights: ['switch.mb_soc'],
					},
				},
			}
			const areaData = prepareAllAreaData(minimalInventory, config, generatorConfig)
			const result = render(areaData, config)

			const cards = result.views[0].sections[0].cards
			const bedroomPopup = cards.find(c => {
				const stack = c.card || c
				return stack.type === 'vertical-stack' &&
          stack.cards?.some(card => card.hash === '#mb_details')
			})

			expect(bedroomPopup).toBeDefined()

			const stack = bedroomPopup.card || bedroomPopup
			const lightsGrid = stack.cards.find(c =>
				c.type === 'grid' && c.cards?.some(card =>
					card.entity === 'light.mb_soc_bulb' || card.entity === 'light.mb_ceiling',
				),
			)

			expect(lightsGrid).toBeDefined()

			// Find the switch with companion - entity should point to bulb
			const switchCard = lightsGrid.cards.find(c => c.entity === 'light.mb_soc_bulb')
			expect(switchCard).toBeDefined()
			expect(switchCard.button_type).toBe('slider')
		})
	})
})

describe('shared.js', () => {

	describe('wrapWithUserCondition', () => {

		test('returns card as-is when visibleToUsers is null', () => {
			const card = { type: 'custom:bubble-card', entity: 'light.test' }
			const result = wrapWithUserCondition(card, null)

			expect(result).toBe(card)
		})

		test('returns card as-is when visibleToUsers is empty array', () => {
			const card = { type: 'custom:bubble-card', entity: 'light.test' }
			const result = wrapWithUserCondition(card, [])

			expect(result).toBe(card)
		})

		test('wraps card in conditional when visibleToUsers has values', () => {
			const card = { type: 'custom:bubble-card', entity: 'light.test' }
			const result = wrapWithUserCondition(card, ['user_1', 'user_2'])

			expect(result.type).toBe('conditional')
			expect(result.conditions).toBeDefined()
			expect(result.conditions[0].condition).toBe('user')
			expect(result.conditions[0].users).toEqual(['user_1', 'user_2'])
			expect(result.card).toBe(card)
		})
	})

	describe('formatEntityName', () => {

		test('returns friendly name when provided', () => {
			const result = formatEntityName('light.lr_ceiling', 'Ceiling Light')

			expect(result).toBe('Ceiling Light')
		})

		test('strips area prefix and title-cases', () => {
			const result = formatEntityName('light.lr_ceiling_light', undefined)

			expect(result).toBe('Ceiling Light')
		})

		test('maps scene suffix standard to Standard', () => {
			const result = formatEntityName('scene.lr_standard', undefined)

			expect(result).toBe('Standard')
		})

		test('maps scene suffix minimal to Minimal', () => {
			const result = formatEntityName('scene.lr_minimal', undefined)

			expect(result).toBe('Minimal')
		})

		test('handles entity with no underscore', () => {
			const result = formatEntityName('light.overhead', undefined)

			expect(result).toBe('Overhead')
		})
	})
})
