// @ts-check
import { join } from 'path'

/**
 * Get path relative to current working directory
 * @param {...string} segments Path segments
 * @returns {string}
 */
export function cwdPath(...segments) {
	return join(process.cwd(), ...segments)
}

// Standard paths relative to CWD
export const paths = {
	// Config files
	generatorConfig: () => cwdPath('generator.config.js'),
	usersConfig: () => cwdPath('users.js'),
	envFile: () => cwdPath('.env'),

	// Dashboards folder
	dashboards: () => cwdPath('dashboards'),
	dashboardConfig: (name) => cwdPath('dashboards', `${name}.config.js`),

	// Inventory folder
	inventory: () => cwdPath('inventory'),
	hassData: () => cwdPath('inventory', 'hass-data.json'),
	entitiesJs: () => cwdPath('inventory', 'entities.js'),
	namingViolations: () => cwdPath('inventory', 'naming-violations.json'),
	typesDir: () => cwdPath('inventory', 'types'),
	hassTypes: () => cwdPath('inventory', 'types', 'hass.d.ts'),
	configTypes: () => cwdPath('inventory', 'types', 'config.d.ts'),

	// i18n files
	i18n: () => cwdPath('i18n'),
	entitiesCsv: () => cwdPath('i18n', 'entities.csv'),
	uiStrings: () => cwdPath('i18n', 'ui-strings.csv'),
	areasCsv: () => cwdPath('i18n', 'areas.csv'),

	// Output folders
	packages: () => cwdPath('packages'),
	packagesAreas: () => cwdPath('packages', 'areas'),
	packagesLabels: () => cwdPath('packages', 'labels'),
	packagesSceneTemplates: () => cwdPath('packages', 'scene-templates'),
	lovelace: () => cwdPath('lovelace'),
	generatedDashboard: () => cwdPath('lovelace', 'generated.yaml'),
}

