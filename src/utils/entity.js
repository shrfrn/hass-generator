// @ts-check

/**
 * Extract the area prefix from entities in a given area
 * Looks for the first underscore-delimited prefix in entity IDs
 * @param {Array<{ entity_id: string, area_id: string | null }>} entities - All entities
 * @param {string} areaId - Area ID to find prefix for
 * @returns {string | null} The prefix (e.g., "lr_") or null if not found
 */
export function extractPrefix(entities, areaId) {
	const areaEntities = entities.filter(e => e.area_id === areaId)

	for (const entity of areaEntities) {
		const name = entity.entity_id.split('.')[1]
		const underscoreIndex = name?.indexOf('_')

		if (underscoreIndex > 0) {
			return name.substring(0, underscoreIndex + 1)
		}
	}

	return null
}

