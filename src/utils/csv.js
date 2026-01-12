// @ts-check

/**
 * Parse a CSV line handling quoted fields correctly
 * Handles escaped quotes ("") and commas within quoted fields
 * @param {string} line - CSV line to parse
 * @returns {string[]} Array of field values
 */
export function parseCsvLine(line) {
	const result = []
	let current = ''
	let inQuotes = false

	for (let i = 0; i < line.length; i++) {
		const char = line[i]

		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"'
				i++
			} else {
				inQuotes = !inQuotes
			}
		} else if (char === ',' && !inQuotes) {
			result.push(current.trim())
			current = ''
		} else {
			current += char
		}
	}

	result.push(current.trim())

	return result
}

/**
 * Escape a value for CSV output
 * Quotes values containing comma, quote, or newline
 * @param {string} value - Value to escape
 * @returns {string} Escaped value safe for CSV
 */
export function escapeCsvValue(value) {
	if (value.includes(',') || value.includes('"') || value.includes('\n')) {
		return '"' + value.replace(/"/g, '""') + '"'
	}
	return value
}

