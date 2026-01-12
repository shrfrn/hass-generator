// @ts-check
import { existsSync, mkdirSync } from 'fs'

/**
 * Ensure a directory exists, creating it recursively if needed
 * @param {string} dir - Directory path to ensure exists
 */
export function ensureDir(dir) {
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

