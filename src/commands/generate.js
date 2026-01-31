// @ts-check
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import YAML from 'yaml'
import { paths } from '../paths.js'
import { ensureDir } from '../utils/fs.js'
import { generateAreaPackages } from '../generators/area-package.js'
import { generateLabelPackages } from '../generators/label-package.js'
import { generateHomePackage } from '../generators/home-package.js'
import { generateAutomations } from '../generators/automations-generated.js'
import { generateSceneTemplates } from '../generators/scene-template-package.js'
import { generateUsersFile } from '../generators/users-package.js'
import { generateDashboard } from '../generators/dashboard/index.js'
import { createTranslator } from '../i18n/index.js'

/**
 * Main generate command - orchestrates YAML and dashboard generation
 * @param {{ dryRun?: boolean, force?: boolean, yamlOnly?: boolean, dashboardOnly?: boolean, dashboard?: string, lang?: string }} options
 */
export async function generate(options = {}) {
	const { dryRun, yamlOnly, dashboardOnly, dashboard, lang } = options

	// Check for required files
	if (!existsSync(paths.generatorConfig())) {
		console.error('❌ generator.config.js not found. Run "hass-gen init" first.')
		process.exit(1)
	}

	if (!existsSync(paths.hassData())) {
		console.error('❌ inventory/hass-data.json not found. Run "hass-gen inventory" first.')
		process.exit(1)
	}

	console.log('⚙️  Generating...')
	if (dryRun) console.log('   (dry-run mode - no files will be written)\n')

	// Load inventory and config
	const inventory = JSON.parse(readFileSync(paths.hassData(), 'utf-8'))
	const configModule = await import(paths.generatorConfig())
	const config = configModule.default

	// Validate schema version
	if (!config.schemaVersion) {
		console.warn('⚠️  Warning: generator.config.js missing schemaVersion')
		console.warn('   Add "schemaVersion: 1" to your config for future compatibility\n')
	}

	/** @type {{ yaml: string[], dashboards: string[] }} */
	const results = { yaml: [], dashboards: [] }

	// Generate YAML packages
	if (!dashboardOnly) {
		results.yaml = await generateYamlPackages(inventory, config)
	}

	// Generate dashboards
	if (!yamlOnly) {
		const dashboardResults = await generateAllDashboards(inventory, config, { dashboard, lang, dryRun })
		results.dashboards = dashboardResults.files
	}

	if (dryRun) {
		console.log('\n📋 Diff preview:')
		console.log('   (diff implementation pending)')
	}

	console.log('\n✨ Generation complete!')
}

/**
 * Generate all YAML packages (area, label, home, scene templates, users)
 * @param {object} inventory - HASS inventory data
 * @param {object} config - Generator config
 * @returns {Promise<string[]>} List of generated file paths
 */
async function generateYamlPackages(inventory, config) {
	console.log('\n📄 Generating YAML packages...')

	ensureDir(paths.packages())
	ensureDir(paths.packagesAreas())
	ensureDir(paths.packagesLabels())
	ensureDir(paths.packagesSceneTemplates())

	const files = []

	const areaFiles = await generateAreaPackages(inventory, config, paths.packages())
	files.push(...areaFiles)

	const labelFiles = await generateLabelPackages(inventory, paths.packages())
	files.push(...labelFiles)

	const homeFiles = await generateHomePackage(inventory, paths.packages())
	files.push(...homeFiles)

	await generateAutomations()

	// Scene templates (not included in index.yaml - for manual use only)
	await generateSceneTemplates(inventory, config, paths.packages())

	// Users file (syncs USERS from inventory, preserves manual groups)
	await generateUsersFile(inventory)

	// Generate index.yaml
	generatePackageIndex(paths.packages(), files)

	console.log(`\n   Generated ${files.length} YAML files`)

	return files
}

/**
 * Generate all configured dashboards
 * @param {object} inventory - HASS inventory data
 * @param {object} config - Generator config
 * @param {{ dashboard?: string, lang?: string, dryRun?: boolean }} options
 * @returns {Promise<{ files: string[], registrations: object[] }>}
 */
async function generateAllDashboards(inventory, config, options) {
	const { dashboard, lang, dryRun } = options
	const dashboardConfigs = await discoverDashboards(dashboard)

	if (dashboardConfigs.length === 0) {
		console.log('\n⚠️  No dashboard configs found in dashboards/ folder')
		console.log('   Create dashboards/main.config.js to generate a dashboard')
		return { files: [], registrations: [] }
	}

	ensureDir(paths.lovelace())

	const files = []
	const registrations = []

	for (const { name, configPath } of dashboardConfigs) {
		const dashboardModule = await import(configPath)
		const dashboardConfig = dashboardModule.default

		if (!dashboardConfig.template) {
			console.error(`\n❌ Dashboard '${name}' missing 'template' field`)
			continue
		}

		const result = await generateSingleDashboard(name, dashboardConfig, inventory, config, { lang, dryRun })
		files.push(...result.files)
		registrations.push(...result.registrations)
	}

	// Update configuration.yaml with dashboard registrations
	if (!dryRun && registrations.length > 0) {
		updateConfigurationYaml(registrations)
	}

	return { files, registrations }
}

/**
 * Generate a single dashboard with all its language variants
 * @param {string} name - Dashboard name
 * @param {object} dashboardConfig - Dashboard configuration
 * @param {object} inventory - HASS inventory data
 * @param {object} config - Generator config
 * @param {{ lang?: string, dryRun?: boolean }} options
 * @returns {Promise<{ files: string[], registrations: object[] }>}
 */
async function generateSingleDashboard(name, dashboardConfig, inventory, config, options) {
	const { lang, dryRun } = options
	const languageVariants = getLanguageVariants(dashboardConfig, lang)

	const files = []
	const registrations = []

	for (const variant of languageVariants) {
		const translator = createTranslator(variant.lang)
		const variantConfig = { ...dashboardConfig, ...variant }
		const dashboardYaml = await generateDashboard(inventory, variantConfig, config, translator)

		// Determine output path
		const outputPath = variant.output
			? join(process.cwd(), variant.output)
			: dashboardConfig.output
				? join(process.cwd(), addLangSuffix(dashboardConfig.output, variant.lang, languageVariants.length > 1))
				: join(paths.lovelace(), `${name}${languageVariants.length > 1 ? `-${variant.lang}` : ''}.yaml`)

		const outputRelative = variant.output
			|| (languageVariants.length > 1 ? addLangSuffix(dashboardConfig.output || `lovelace/${name}.yaml`, variant.lang, true) : dashboardConfig.output || `lovelace/${name}.yaml`)

		if (!dryRun) {
			ensureDir(join(outputPath, '..'))
			writeFileSync(outputPath, YAML.stringify(dashboardYaml))
			console.log(`   📝 Written to ${outputRelative}`)
		}

		files.push(`${name}${languageVariants.length > 1 ? `-${variant.lang}` : ''}`)

		// Collect registration info
		const regPath = variant.dashboard_path || dashboardConfig.dashboard_path
		if (regPath) {
			registrations.push({
				path: regPath,
				title: variant.dashboard_title || dashboardConfig.dashboard_title || dashboardConfig.dashboard_name || name,
				icon: variant.dashboard_icon || dashboardConfig.dashboard_icon || 'mdi:view-dashboard',
				show_in_sidebar: (variant.show_in_sidebar ?? dashboardConfig.show_in_sidebar) !== false,
				filename: outputRelative,
			})
		}
	}

	return { files, registrations }
}

/**
 * Discover dashboard configs in dashboards/ folder
 * @param {string} [filterName] - Optional dashboard name to filter
 * @returns {Promise<Array<{ name: string, configPath: string }>>}
 */
async function discoverDashboards(filterName) {
	const dashboardsDir = paths.dashboards()
	if (!existsSync(dashboardsDir)) return []

	const files = readdirSync(dashboardsDir)
	const configs = []

	for (const file of files) {
		if (!file.endsWith('.config.js')) continue

		const name = file.replace('.config.js', '')

		if (filterName) {
			const requestedNames = filterName.split(',').map(n => n.trim())
			if (!requestedNames.includes(name)) continue
		}

		configs.push({ name, configPath: join(dashboardsDir, file) })
	}

	return configs
}

/**
 * Get language variants to generate based on config and CLI flag
 * @param {object} dashboardConfig - Dashboard config
 * @param {string} [langFlag] - CLI --lang flag value
 * @returns {Array<{ lang: string, [key: string]: any }>}
 */
function getLanguageVariants(dashboardConfig, langFlag) {
	const { languages } = dashboardConfig

	// If no languages array, use single-language mode
	if (!languages || languages.length === 0) {
		const lang = langFlag || dashboardConfig.language || 'en'
		return [{ lang }]
	}

	// --lang all generates all variants
	if (langFlag === 'all') return languages

	// --lang <code> filters to specific language
	if (langFlag) {
		const variant = languages.find(v => v.lang === langFlag)
		if (variant) return [variant]

		console.warn(`   ⚠ Language '${langFlag}' not in config.languages, using base config`)
		return [{ lang: langFlag }]
	}

	// No flag - generate all variants
	return languages
}

/**
 * Add language suffix to output path
 * @param {string} outputPath - Original output path
 * @param {string} lang - Language code
 * @param {boolean} addSuffix - Whether to add suffix
 * @returns {string}
 */
function addLangSuffix(outputPath, lang, addSuffix) {
	if (!addSuffix) return outputPath

	const lastDot = outputPath.lastIndexOf('.')
	if (lastDot === -1) return `${outputPath}-${lang}`

	return `${outputPath.slice(0, lastDot)}-${lang}${outputPath.slice(lastDot)}`
}

/**
 * Generate packages/index.yaml with manual and auto-generated entries
 * @param {string} packagesDir - Path to packages directory
 * @param {string[]} generatedFiles - List of generated package files
 */
function generatePackageIndex(packagesDir, generatedFiles) {
	const indexPath = join(packagesDir, 'index.yaml')
	const manualEntries = extractManualEntries(indexPath)

	const lines = [
		'# ============================================================',
		'# Package Index - Auto-managed by hass-gen',
		'# ============================================================',
		'# DO NOT edit the auto-generated section below.',
		'# Add manual packages in the section marked "Manual packages".',
		'# ============================================================',
		'',
		'# ------------------------------------------------------------',
		'# Manual packages (add your custom packages here)',
		'# ------------------------------------------------------------',
	]

	for (const entry of manualEntries) {
		lines.push(entry)
	}

	if (manualEntries.length === 0) {
		lines.push('# example: my_package: !include my_package.yaml')
	}

	lines.push('')
	lines.push('# ------------------------------------------------------------')
	lines.push('# Auto-generated packages (DO NOT EDIT below this line)')
	lines.push('# ------------------------------------------------------------')

	const sortedFiles = [...generatedFiles].sort()

	for (const file of sortedFiles) {
		const key = file.replace(/\//g, '_').replace('.yaml', '')
		lines.push(`${key}: !include ${file}`)
	}

	lines.push('')

	writeFileSync(indexPath, lines.join('\n'))
	console.log('\n  ✓ index.yaml')
}

/**
 * Extract manual entries from existing index.yaml
 * @param {string} indexPath - Path to index.yaml
 * @returns {string[]} Array of manual entry lines
 */
function extractManualEntries(indexPath) {
	if (!existsSync(indexPath)) return []

	const content = readFileSync(indexPath, 'utf-8')
	const lines = content.split('\n')
	const manualEntries = []
	let inManualSection = false

	for (const line of lines) {
		if (line.includes('Manual packages')) {
			inManualSection = true
			continue
		}

		if (line.includes('Auto-generated')) {
			inManualSection = false
			continue
		}

		const trimmed = line.trim()
		const isComment = trimmed.startsWith('#')
		const isDivider = trimmed.startsWith('# ---') || trimmed.startsWith('# ===')

		if (inManualSection && trimmed && !isComment && !isDivider) {
			manualEntries.push(line)
		}
	}

	return manualEntries
}

/**
 * Rebuild configuration.yaml from base template with dashboard registrations
 * @param {Array<{ path: string, title: string, icon: string, show_in_sidebar: boolean, filename: string }>} registrations
 */
function updateConfigurationYaml(registrations) {
	const basePath = join(process.cwd(), 'configuration.base.yaml')
	const configPath = join(process.cwd(), 'configuration.yaml')

	// Check for base template
	if (!existsSync(basePath)) {
		console.warn('\n⚠️  configuration.base.yaml not found, falling back to in-place update')
		updateConfigurationYamlLegacy(registrations, configPath)
		return
	}

	// Read base template and parse
	const baseContent = readFileSync(basePath, 'utf-8')
	const doc = YAML.parseDocument(baseContent)

	// Build dashboards section from scratch
	const dashboards = {}
	for (const reg of registrations) {
		dashboards[reg.path] = {
			mode: 'yaml',
			title: reg.title,
			icon: reg.icon,
			show_in_sidebar: reg.show_in_sidebar,
			filename: reg.filename,
		}
	}

	// Set dashboards (replaces any existing)
	if (Object.keys(dashboards).length > 0) {
		doc.setIn(['lovelace', 'dashboards'], dashboards)
	}

	writeFileSync(configPath, doc.toString())
	console.log(`\n  ✓ configuration.yaml (rebuilt from base, ${registrations.length} dashboard${registrations.length > 1 ? 's' : ''})`)
}

/**
 * Legacy in-place update for backwards compatibility
 * @param {Array<{ path: string, title: string, icon: string, show_in_sidebar: boolean, filename: string }>} registrations
 * @param {string} configPath
 */
function updateConfigurationYamlLegacy(registrations, configPath) {
	if (!existsSync(configPath)) {
		console.warn('\n⚠️  configuration.yaml not found, skipping dashboard registration')
		return
	}

	const content = readFileSync(configPath, 'utf-8')
	const doc = YAML.parseDocument(content)

	let lovelace = doc.get('lovelace')
	if (!lovelace) {
		lovelace = doc.createNode({})
		doc.set('lovelace', lovelace)
	}

	let dashboards = doc.getIn(['lovelace', 'dashboards'])
	if (!dashboards) {
		dashboards = doc.createNode({})
		doc.setIn(['lovelace', 'dashboards'], dashboards)
	}

	for (const reg of registrations) {
		const dashboardEntry = {
			mode: 'yaml',
			title: reg.title,
			icon: reg.icon,
			show_in_sidebar: reg.show_in_sidebar,
			filename: reg.filename,
		}
		doc.setIn(['lovelace', 'dashboards', reg.path], dashboardEntry)
	}

	writeFileSync(configPath, doc.toString())
	console.log(`\n  ✓ configuration.yaml (${registrations.length} dashboard${registrations.length > 1 ? 's' : ''} registered)`)
}
