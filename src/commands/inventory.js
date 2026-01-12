// @ts-check
import { config as loadEnv } from 'dotenv'
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { paths } from '../paths.js'
import { ensureDir } from '../utils/fs.js'
import { connect, disconnect } from '../websocket.js'
import { fetchAllData } from '../fetchers.js'
import { transformData } from '../transform.js'
import { checkNamingConsistency, printNamingReport, writeNamingReport } from '../validation/naming-check.js'
import { mergeEntities, mergeAreas } from '../i18n/merge-csv.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function inventory() {
	// Load .env from current directory
	loadEnv({ path: paths.envFile() })

	const host = process.env.HASS_HOST
	const port = parseInt(process.env.HASS_PORT || '8123', 10)
	const token = process.env.HASS_TOKEN

	if (!host || !token) {
		console.error('❌ Missing HASS_HOST or HASS_TOKEN in .env')
		console.error('   Create a .env file with:')
		console.error('   HASS_HOST=homeassistant.local')
		console.error('   HASS_TOKEN=your_long_lived_access_token')
		process.exit(1)
	}

	console.log(`🔌 Connecting to Home Assistant at ${host}:${port}...`)

	try {
		await connect(host, port, token)

		console.log('\n📦 Fetching data from Home Assistant...')
		const rawData = await fetchAllData()

		console.log('\n🔄 Transforming data...')
		const data = transformData(rawData)

		console.log('\n📊 Summary:')
		console.log(`   ${data.entities?.length || 0} entities`)
		console.log(`   ${data.areas?.length || 0} areas`)
		console.log(`   ${data.labels?.length || 0} labels`)
		console.log(`   ${data.floors?.length || 0} floors`)

		// Ensure directories exist
		ensureDir(paths.inventory())
		ensureDir(paths.typesDir())
		ensureDir(paths.i18n())

		// Write inventory files
		console.log('\n💾 Writing inventory files...')

		writeInventoryData(data)
		writeEntitiesJs(data)
		writeHassTypes(data)
		writeConfigTypes()

		// Merge entities (preserves existing translations, adds new entities)
		console.log('\n🌐 Updating i18n...')
		const i18nResult = mergeEntities(paths.entitiesCsv(), data.entities || [])
		console.log('   ✅ i18n/entities.csv')

		if (i18nResult.added > 0 || i18nResult.removed > 0) {
			console.log(`      ${i18nResult.added} new, ${i18nResult.removed} removed, ${i18nResult.updated} updated`)
		}

		// Merge areas (separate file)
		const areasResult = mergeAreas(paths.areasCsv(), data.areas || [])
		console.log('   ✅ i18n/areas.csv')

		if (areasResult.added > 0 || areasResult.removed > 0) {
			console.log(`      ${areasResult.added} new, ${areasResult.removed} removed, ${areasResult.updated} updated`)
		}

		console.log('\n🔍 Checking naming consistency...')
		const namingResults = checkNamingConsistency(data)
		printNamingReport(namingResults)
		writeNamingReport(namingResults, paths.namingViolations())

		disconnect()

		console.log('\n✨ Inventory complete!')
		console.log('   Now run: npx hass-gen generate')

	} catch (err) {
		console.error(`\n❌ Error: ${err.message}`)
		disconnect()
		process.exit(1)
	}
}


function writeInventoryData(data) {
	const filePath = paths.hassData()
	writeFileSync(filePath, JSON.stringify(data, null, 2))
	console.log('   ✅ inventory/hass-data.json')
}

function writeEntitiesJs(data) {
	const filePath = paths.entitiesJs()
	const lines = [
		'// Entity reference - browse entities by area',
		'// Regenerated on each inventory run - DO NOT EDIT',
		'// Use this file to find entity IDs for your config',
		'',
	]

	// Group entities by area
	const byArea = {}
	for (const entity of data.entities || []) {
		const areaId = entity.area_id || '_unassigned'
		if (!byArea[areaId]) byArea[areaId] = []
		byArea[areaId].push(entity.entity_id)
	}

	// Write each area
	for (const [areaId, entities] of Object.entries(byArea).sort()) {
		const areaName = data.areas?.find(a => a.id === areaId)?.name || areaId
		lines.push(`// ${areaName} (${areaId})`)
		lines.push(`export const ${sanitizeVarName(areaId)} = [`)

		for (const entityId of entities.sort()) {
			lines.push(`  '${entityId}',`)
		}

		lines.push(']')
		lines.push('')
	}

	writeFileSync(filePath, lines.join('\n'))
	console.log('   ✅ inventory/entities.js')
}

function writeHassTypes(data) {
	const filePath = paths.hassTypes()
	const lines = [
		'// Auto-generated type definitions from Home Assistant',
		'// Regenerated on each inventory run - DO NOT EDIT',
		'',
	]

	// AreaId type
	lines.push('/** Valid area IDs from Home Assistant */')
	lines.push('export type AreaId =')
	for (const area of (data.areas || []).sort((a, b) => a.id.localeCompare(b.id))) {
		lines.push(`  | '${area.id}'`)
	}
	lines.push('')

	// LabelId type
	lines.push('/** Valid label IDs from Home Assistant */')
	lines.push('export type LabelId =')
	if (data.labels?.length) {
		for (const label of data.labels.sort((a, b) => a.id.localeCompare(b.id))) {
			lines.push(`  | '${label.id}'`)
		}
	} else {
		lines.push('  | never')
	}
	lines.push('')

	// EntityId type
	lines.push('/** Valid entity IDs from Home Assistant */')
	lines.push('export type EntityId =')
	for (const entity of (data.entities || []).sort((a, b) => a.entity_id.localeCompare(b.entity_id))) {
		lines.push(`  | '${entity.entity_id}'`)
	}
	lines.push('')

	writeFileSync(filePath, lines.join('\n'))
	console.log('   ✅ inventory/types/hass.d.ts')
}

function writeConfigTypes() {
	const filePath = paths.configTypes()
	const templatePath = join(__dirname, '../../templates/types/config.d.ts.template')
	const content = readFileSync(templatePath, 'utf-8')

	writeFileSync(filePath, content)
	console.log('   ✅ inventory/types/config.d.ts')
}

function sanitizeVarName(str) {
	return str.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&')
}
