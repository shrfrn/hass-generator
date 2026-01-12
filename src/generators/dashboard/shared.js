// @ts-check
// Template-agnostic dashboard utilities
// These functions work with any card type and can be shared across templates

/**
 * Scene suffix to display name mapping
 */
const SCENE_DISPLAY_NAMES = {
	standard: 'Standard',
	minimal: 'Minimal',
}

/**
 * Create translation helper functions that wrap the translator
 * @param {object | null} translator - Translator object with tEntity, tUi, tArea methods
 * @returns {{ entity: Function, ui: Function, area: Function }}
 */
export function createTranslationHelpers(translator) {
	if (translator) {
		return {
			entity: (entityId, originalName) => translator.tEntity(entityId, originalName),
			ui: key => translator.tUi(key),
			area: (areaId, originalName) => translator.tArea(areaId, originalName),
		}
	}

	// Fallback when no translator provided
	return {
		entity: (entityId, originalName) => formatEntityName(entityId, originalName),
		ui: key => key.split('.').pop() || key,
		area: (areaId, originalName) => originalName || areaId,
	}
}

/**
 * Format an entity ID as a readable name
 * Handles scene suffixes and removes area prefixes
 * @param {string} entityId - Entity ID (e.g., 'light.lr_ceiling')
 * @param {string} [name] - Optional friendly name from HA
 * @returns {string} Formatted name
 */
export function formatEntityName(entityId, name) {
	const parts = entityId.split('.')
	const id = parts[1] || entityId

	// Handle scene display names
	if (parts[0] === 'scene') {
		for (const [suffix, displayName] of Object.entries(SCENE_DISPLAY_NAMES)) {
			if (id.endsWith(`_${suffix}`)) {
				return displayName
			}
		}
	}

	// Use provided name if meaningful
	if (name && name !== id) return name

	// Strip area prefix and title-case
	const withoutPrefix = id.replace(/^[a-z]+_/, '')

	return withoutPrefix
		.split('_')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')
}

/**
 * Wrap a card with a user visibility condition
 * Works with any card type - this is a Home Assistant conditional card pattern
 * @param {object} card - The card configuration object
 * @param {string[] | null} visibleToUsers - Array of user IDs or null for all users
 * @returns {object} Original card or wrapped conditional card
 */
export function wrapWithUserCondition(card, visibleToUsers) {
	if (!visibleToUsers || visibleToUsers.length === 0) return card

	return {
		type: 'conditional',
		conditions: [
			{
				condition: 'user',
				users: visibleToUsers,
			},
		],
		card,
	}
}

