// @ts-check
// i18n module - load and lookup translations from CSV files

import { existsSync, readFileSync } from 'fs'
import { paths } from '../paths.js'
import { parseCsvLine } from '../utils/csv.js'

// Domains that should appear in entities.csv (controllable entities + scenes)
export const TRANSLATABLE_DOMAINS = [
	'light',
	'switch',
	'climate',
	'fan',
	'cover',
	'lock',
	'media_player',
	'vacuum',
	'scene',
]

// Scene suffixes to exclude from translations (auto-generated template scenes)
export const EXCLUDED_SCENE_SUFFIXES = ['_standard', '_template']

/**
 * Load translations from CSV file
 * @param {string} filePath - Path to CSV file
 * @returns {Map<string, Record<string, string>>} Map of id -> { lang: translation }
 */
export function loadTranslationsFromCsv(filePath) {
	const map = new Map()

	if (!existsSync(filePath)) return map

	const content = readFileSync(filePath, 'utf-8')
	const lines = content.split('\n').filter(line => line.trim())

	if (lines.length === 0) return map

	const headers = parseCsvLine(lines[0]) // First column is entity_id or key

	for (let i = 1; i < lines.length; i++) {
		const values = parseCsvLine(lines[i])
		const id = values[0]

		if (!id) continue

		const translations = {}

		for (let j = 1; j < headers.length; j++) {
			const lang = headers[j]
			const value = values[j] || ''

			if (value) translations[lang] = value
		}

		map.set(id, translations)
	}

	return map
}

/**
 * Create a translator function for a specific language
 * @param {string} lang - Language code (e.g., 'en', 'he')
 * @returns {{ t: Function, tEntity: Function, tUi: Function, tArea: Function }}
 */
export function createTranslator(lang = 'en') {
	const entityTranslations = loadTranslationsFromCsv(paths.entitiesCsv())
	const uiTranslations = loadTranslationsFromCsv(paths.uiStrings())

	/**
   * Get entity translation with fallback chain: lang -> en -> original name
   * @param {string} entityId - Entity ID
   * @param {string} [originalName] - Original name from HA
   * @returns {string}
   */
	function tEntity(entityId, originalName = '') {
		const translations = entityTranslations.get(entityId)

		if (!translations) return originalName || formatEntityId(entityId)

		return translations[lang] || translations.en || originalName || formatEntityId(entityId)
	}

	/**
   * Get UI string translation with fallback to English
   * @param {string} key - UI string key (e.g., 'section.lights')
   * @returns {string}
   */
	function tUi(key) {
		const translations = uiTranslations.get(key)

		if (!translations) return key.split('.').pop() || key

		return translations[lang] || translations.en || key.split('.').pop() || key
	}

	// Load area translations from separate file
	const areaTranslations = loadTranslationsFromCsv(paths.areasCsv())

	/**
   * Get area name translation with fallback to original name
   * @param {string} areaId - Area ID (e.g., 'living_room')
   * @param {string} [originalName] - Original area name from HA
   * @returns {string}
   */
	function tArea(areaId, originalName = '') {
		const translations = areaTranslations.get(areaId)

		if (!translations) return originalName || areaId

		return translations[lang] || translations.en || originalName || areaId
	}

	/**
   * Generic translation lookup
   * @param {string} key - Translation key
   * @param {string} [fallback] - Fallback value
   * @returns {string}
   */
	function t(key, fallback = '') {
		// Try UI strings first, then entity translations
		const ui = uiTranslations.get(key)
		if (ui) return ui[lang] || ui.en || fallback || key

		const entity = entityTranslations.get(key)
		if (entity) return entity[lang] || entity.en || fallback || key

		return fallback || key
	}

	return { t, tEntity, tUi, tArea }
}

/**
 * Format entity ID as readable name (fallback when no translation)
 * @param {string} entityId - Entity ID (e.g., 'light.lr_lt_ceiling')
 * @returns {string}
 */
function formatEntityId(entityId) {
	const parts = entityId.split('.')
	const id = parts[1] || entityId
	const withoutPrefix = id.replace(/^[a-z]+_/, '')

	return withoutPrefix
		.split('_')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')
}

/**
 * Check if an entity should be included in translations
 * @param {object} entity - Entity object with entity_id
 * @returns {boolean}
 */
export function isTranslatableEntity(entity) {
	const entityId = entity.entity_id
	const domain = entityId?.split('.')[0]

	if (!TRANSLATABLE_DOMAINS.includes(domain)) return false

	// Exclude standard/template scenes
	if (domain === 'scene') {
		for (const suffix of EXCLUDED_SCENE_SUFFIXES) {
			if (entityId.endsWith(suffix)) return false
		}
	}

	return true
}
