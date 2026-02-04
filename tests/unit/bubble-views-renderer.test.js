// @ts-check
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render } from '../../src/generators/dashboard/templates/bubble-views/renderer.js'
import { prepareAllAreaData } from '../../src/generators/dashboard/data.js'
import minimalInventory from '../fixtures/minimal-inventory.json'
import dashboardConfig from '../fixtures/dashboard-config.js'
import generatorConfig from '../fixtures/generator-config.js'

beforeEach(() => {
	vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('bubble-views/renderer.js', () => {

	describe('media popup Close button', () => {

		test('navigates to area view when closing (not to main home)', () => {
			const config = { ...dashboardConfig, dashboard_path: 'views' }
			const areaData = prepareAllAreaData(minimalInventory, config, generatorConfig)
			const result = render(areaData, config)

			const livingRoomView = result.views.find(v => v.path === 'living-room')
			expect(livingRoomView).toBeDefined()

			// Popup is in a vertical-stack at the END of the view's cards
			const cards = livingRoomView.sections[0].cards
			const popupStack = cards.find(c => {
				const card = c.card ?? c
				return card.type === 'vertical-stack' && card.cards?.some(pc => pc.card_type === 'pop-up')
			})
			expect(popupStack).toBeDefined()

			const stack = popupStack.card ?? popupStack
			const subButtonsCard = stack.cards.find(c => {
				if (c.card_type !== 'sub-buttons') return false
				return c.sub_button?.bottom?.some(b => b.name === 'Exit')
			})
			expect(subButtonsCard).toBeDefined()

			const exitGroup = subButtonsCard.sub_button?.bottom?.find(b => b.name === 'Exit')
			expect(exitGroup).toBeDefined()

			const closeButton = exitGroup.group?.find(b => b.name === 'Close')
			expect(closeButton).toBeDefined()
			expect(closeButton.tap_action?.action).toBe('navigate')
			expect(closeButton.tap_action?.navigation_path).toBe('/views/living-room')
		})
	})
})
