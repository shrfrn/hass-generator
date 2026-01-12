// @ts-check
// Merge new entities into existing i18n CSV files without overwriting translations

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { isTranslatableEntity } from './index.js'
import { parseCsvLine, escapeCsvValue } from '../utils/csv.js'

// Default language columns for new CSV files
const DEFAULT_LANGUAGES = ['en', 'he']

/**
 * Merge entities from HA into entities CSV
 * Preserves existing translations, adds new entries, marks removed ones
 * @param {string} csvPath - Path to entities.csv
 * @param {object[]} entities - Array of entity objects from HA
 * @returns {{ added: number, removed: number, updated: number }}
 */
export function mergeEntities(csvPath, entities) {
	const translatableEntities = entities.filter(isTranslatableEntity)
	const haEntityIds = new Set(translatableEntities.map(e => e.entity_id))

	// Build entity lookup for area info
	const entityLookup = new Map()
	for (const entity of translatableEntities) {
		entityLookup.set(entity.entity_id, entity)
	}

	// Load existing CSV or create new structure
	const { headers, rows } = existsSync(csvPath)
		? parseCsv(csvPath)
		: { headers: ['entity_id', 'status', 'area', ...DEFAULT_LANGUAGES], rows: [] }

	// Ensure we have the required columns
	const langColumns = headers.slice(3) // columns after entity_id, status, area

	// Track existing entities
	const existingIds = new Set()
	let updated = 0
	let removed = 0

	// Update existing rows
	for (const row of rows) {
		const entityId = row.entity_id
		existingIds.add(entityId)

		if (haEntityIds.has(entityId)) {
			// Entity still exists - update area, clear removed status
			const entity = entityLookup.get(entityId)

			if (row.status === 'removed') {
				row.status = ''
				updated++
			}

			if (entity?.area_id && row.area !== entity.area_id) {
				row.area = entity.area_id
				updated++
			}

			// Pre-populate English name if empty and entity has a name
			if (!row.en && entity?.name) {
				row.en = entity.name
				updated++
			}
		} else if (row.status !== 'removed') {
			// Entity no longer exists - mark as removed
			row.status = 'removed'
			removed++
		}
	}

	// Add new entities
	let added = 0

	for (const entity of translatableEntities) {
		if (existingIds.has(entity.entity_id)) continue

		const newRow = {
			entity_id: entity.entity_id,
			status: '',
			area: entity.area_id || '',
		}

		// Initialize language columns - pre-populate English with HA name
		for (const lang of langColumns) {
			newRow[lang] = lang === 'en' && entity.name ? entity.name : ''
		}

		rows.push(newRow)
		added++
	}

	// Sort by area, then entity_id
	rows.sort((a, b) => {
		const areaCompare = (a.area || '').localeCompare(b.area || '')
		if (areaCompare !== 0) return areaCompare
		return a.entity_id.localeCompare(b.entity_id)
	})

	// Write back
	writeCsv(csvPath, headers, rows)

	return { added, removed, updated }
}

/**
 * Merge areas from HA into areas CSV
 * Preserves existing translations, adds new areas, marks removed ones
 * @param {string} csvPath - Path to areas.csv
 * @param {object[]} areas - Array of area objects from HA
 * @returns {{ added: number, removed: number, updated: number }}
 */
export function mergeAreas(csvPath, areas) {
	const haAreaIds = new Set(areas.map(a => a.id))

	// Build area lookup
	const areaLookup = new Map()
	for (const area of areas) {
		areaLookup.set(area.id, area)
	}

	// Load existing CSV or create new structure
	const { headers, rows } = existsSync(csvPath)
		? parseAreasCsv(csvPath)
		: { headers: ['area_id', 'status', ...DEFAULT_LANGUAGES], rows: [] }

	const langColumns = headers.slice(2) // columns after area_id, status

	// Track existing areas
	const existingIds = new Set()
	let updated = 0
	let removed = 0

	// Update existing rows
	for (const row of rows) {
		const areaId = row.area_id
		existingIds.add(areaId)

		if (haAreaIds.has(areaId)) {
			const area = areaLookup.get(areaId)

			if (row.status === 'removed') {
				row.status = ''
				updated++
			}

			// Pre-populate English name if empty
			if (!row.en && area?.name) {
				row.en = area.name
				updated++
			}
		} else if (row.status !== 'removed') {
			row.status = 'removed'
			removed++
		}
	}

	// Add new areas
	let added = 0

	for (const area of areas) {
		if (existingIds.has(area.id)) continue

		const newRow = {
			area_id: area.id,
			status: '',
		}

		for (const lang of langColumns) {
			newRow[lang] = lang === 'en' && area.name ? area.name : ''
		}

		rows.push(newRow)
		added++
	}

	// Sort by area_id
	rows.sort((a, b) => a.area_id.localeCompare(b.area_id))

	// Write back
	writeAreasCsv(csvPath, headers, rows)

	return { added, removed, updated }
}

/**
 * Parse areas CSV file
 * @param {string} csvPath - Path to CSV file
 * @returns {{ headers: string[], rows: object[] }}
 */
function parseAreasCsv(csvPath) {
	const content = readFileSync(csvPath, 'utf-8')
	const lines = content.split('\n').filter(line => line.trim())

	if (lines.length === 0) {
		return { headers: ['area_id', 'status', ...DEFAULT_LANGUAGES], rows: [] }
	}

	const headers = parseCsvLine(lines[0])
	const rows = []

	for (let i = 1; i < lines.length; i++) {
		const values = parseCsvLine(lines[i])
		const row = {}

		for (let j = 0; j < headers.length; j++) {
			row[headers[j]] = values[j] || ''
		}

		if (row.area_id) rows.push(row)
	}

	return { headers, rows }
}

/**
 * Write areas CSV
 * @param {string} csvPath - Path to CSV file
 * @param {string[]} headers - Column headers
 * @param {object[]} rows - Row objects
 */
function writeAreasCsv(csvPath, headers, rows) {
	const lines = [headers.join(',')]

	for (const row of rows) {
		const values = headers.map(h => escapeCsvValue(row[h] || ''))
		lines.push(values.join(','))
	}

	writeFileSync(csvPath, lines.join('\n') + '\n')
}

/**
 * Parse CSV file into headers and row objects
 * @param {string} csvPath - Path to CSV file
 * @returns {{ headers: string[], rows: object[] }}
 */
function parseCsv(csvPath) {
	const content = readFileSync(csvPath, 'utf-8')
	const lines = content.split('\n').filter(line => line.trim())

	if (lines.length === 0) {
		return { headers: ['entity_id', 'status', 'area', ...DEFAULT_LANGUAGES], rows: [] }
	}

	const headers = parseCsvLine(lines[0])
	const rows = []

	for (let i = 1; i < lines.length; i++) {
		const values = parseCsvLine(lines[i])
		const row = {}

		for (let j = 0; j < headers.length; j++) {
			row[headers[j]] = values[j] || ''
		}

		if (row.entity_id) rows.push(row)
	}

	return { headers, rows }
}

/**
 * Write rows back to CSV file
 * @param {string} csvPath - Path to CSV file
 * @param {string[]} headers - Column headers
 * @param {object[]} rows - Row objects
 */
function writeCsv(csvPath, headers, rows) {
	const lines = [headers.join(',')]

	for (const row of rows) {
		const values = headers.map(h => escapeCsvValue(row[h] || ''))
		lines.push(values.join(','))
	}

	writeFileSync(csvPath, lines.join('\n') + '\n')
}
