// @ts-check

/**
 * Sanitize a string for use as a filename
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string with only alphanumeric and underscores, lowercased
 */
export function sanitizeFileName(str) {
	return str.replace(/[^a-z0-9_]/gi, '_').toLowerCase()
}

/**
 * Extract the first name from a full name string
 * @param {string} fullName - Full name (e.g., "John Doe")
 * @returns {string} First name (e.g., "John")
 */
export function extractFirstName(fullName) {
	return fullName.split(' ')[0]
}

