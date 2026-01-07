// @ts-check
import { config as loadEnv } from 'dotenv'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { paths } from '../paths.js'
import { connect, disconnect } from '../websocket.js'
import { fetchAllData } from '../fetchers.js'
import { transformData } from '../transform.js'
import { checkNamingConsistency, printNamingReport, writeNamingReport } from '../validation/naming-check.js'

export async function inventory() {
  // Load .env from current directory
  loadEnv({ path: paths.envFile() })

  const host = process.env.HASS_HOST
  const port = process.env.HASS_PORT || '8123'
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

    console.log(`\n📊 Summary:`)
    console.log(`   ${data.entities?.length || 0} entities`)
    console.log(`   ${data.areas?.length || 0} areas`)
    console.log(`   ${data.labels?.length || 0} labels`)
    console.log(`   ${data.floors?.length || 0} floors`)

    // Ensure inventory directories exist
    ensureDir(paths.inventory())
    ensureDir(paths.typesDir())

    // Write inventory files
    console.log('\n💾 Writing inventory files...')

    writeInventoryData(data)
    writeEntitiesJs(data)
    writeHassTypes(data)
    writeConfigTypes()

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

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function writeInventoryData(data) {
  const filePath = paths.hassData()
  writeFileSync(filePath, JSON.stringify(data, null, 2))
  console.log(`   ✅ inventory/hass-data.json`)
}

function writeEntitiesJs(data) {
  const filePath = paths.entities()
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

    lines.push(`]`)
    lines.push('')
  }

  writeFileSync(filePath, lines.join('\n'))
  console.log(`   ✅ inventory/entities.js`)
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
    lines.push(`  | never`)
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
  console.log(`   ✅ inventory/types/hass.d.ts`)
}

function writeConfigTypes() {
  const filePath = paths.configTypes()
  const content = `// Type definitions for generator config
// These types are stable and only change with tool updates

import type { AreaId, EntityId, LabelId } from './hass.d.ts'

export interface AreaConfig {
  /** Override vacancy timer duration for this area */
  vacancy_timer_duration?: string

  /** Entity IDs to add to the light group */
  include_in_group?: EntityId[]

  /** Entity IDs to exclude from the light group */
  exclude_from_group?: EntityId[]

  /** Labels to exclude (overrides global excluded_labels for this area) */
  excluded_labels?: LabelId[]

  /** Labels to include (added to global included_labels for this area) */
  included_labels?: LabelId[]

  /**
   * Maps on/off actuators to their companion dimmable bulbs.
   * The actuator controls power, the bulb controls brightness.
   * Companion bulbs are auto-excluded from light groups and dashboard lists.
   * @example { 'switch.mb_soc': 'light.mb_soc_bulb' }
   */
  dimmable_companions?: Partial<Record<EntityId, EntityId>>
}

export interface GeneratorConfig {
  /** Schema version - do not change manually */
  schemaVersion: number

  /** Default vacancy timer duration (HH:MM:SS format) */
  default_vacancy_duration?: string

  /** Labels to exclude from ALL light groups by default */
  excluded_labels?: LabelId[]

  /** Labels to always include in light groups */
  included_labels?: LabelId[]

  /** Per-area configuration overrides */
  areas?: Partial<Record<AreaId, AreaConfig>>
}

export interface DashboardAreaConfig {
  /** Lights to exclude from the Lights section */
  excluded_lights?: EntityId[]

  /** Entities to add to the Lights section (display only) */
  included_lights?: EntityId[]

  /** Scenes from other areas to include in this area's detailed view */
  included_scenes?: EntityId[]

  /** Scenes to exclude from this area's detailed view (show in another area instead) */
  excluded_scenes?: EntityId[]

  /** User IDs that can see this area */
  visible_to_users?: string[]
}

/** Available dashboard templates */
export type DashboardTemplate = 'bubble' | 'mushroom'

export interface DashboardConfig {
  /** Schema version - do not change manually */
  schemaVersion: number

  /** Dashboard template to use (e.g., 'bubble', 'mushroom') */
  template: DashboardTemplate

  /** Output file path (relative to project root) */
  output: string

  /** Dashboard view title */
  dashboard_name?: string

  /** Areas to pin at the top of the dashboard (in order) */
  pinned_areas?: AreaId[]

  /** Areas to exclude from the dashboard */
  excluded_areas?: AreaId[]

  /** Scene suffix for default tap action */
  default_scene_suffix?: string

  /** Per-area dashboard configuration */
  areas?: Partial<Record<AreaId, DashboardAreaConfig>>
}
`

  writeFileSync(filePath, content)
  console.log(`   ✅ inventory/types/config.d.ts`)
}

function sanitizeVarName(str) {
  return str.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&')
}
