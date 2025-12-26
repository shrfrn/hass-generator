// @ts-check
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { paths } from '../paths.js'
import { generateAreaPackages } from '../generators/area-package.js'
import { generateLabelPackages } from '../generators/label-package.js'

/**
 * @param {{ dryRun?: boolean, force?: boolean, yamlOnly?: boolean, dashboardOnly?: boolean }} options
 */
export async function generate(options = {}) {
  const { dryRun, force, yamlOnly, dashboardOnly } = options

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

  if (dryRun) {
    console.log('   (dry-run mode - no files will be written)\n')
  }

  // Load inventory data
  const inventory = JSON.parse(readFileSync(paths.hassData(), 'utf-8'))

  // Load config (dynamic import for ESM)
  const configModule = await import(paths.generatorConfig())
  const config = configModule.default

  // Validate schema version
  if (!config.schemaVersion) {
    console.warn('⚠️  Warning: generator.config.js missing schemaVersion')
    console.warn('   Add "schemaVersion: 1" to your config for future compatibility\n')
  }

  const results = { yaml: [], dashboard: null, }

  // Generate YAML packages
  if (!dashboardOnly) {
    console.log('\n📄 Generating YAML packages...')

    // Ensure directories exist
    ensureDir(paths.packages())
    ensureDir(paths.packagesAreas())
    ensureDir(paths.packagesLabels())

    // Generate area packages
    const areaFiles = await generateAreaPackages(inventory, config, paths.packages())
    results.yaml.push(...areaFiles)

    // Generate label packages
    const labelFiles = await generateLabelPackages(inventory, paths.packages())
    results.yaml.push(...labelFiles)

    console.log(`\n   Generated ${results.yaml.length} YAML files`)
  }

  // Generate dashboard
  if (!yamlOnly) {
    console.log('\n🎨 Generating dashboard...')

    // Load dashboard config
    let dashboardConfig = {}

    if (existsSync(paths.dashboardConfig())) {
      const dashboardModule = await import(paths.dashboardConfig())
      dashboardConfig = dashboardModule.default
    } else {
      console.log('   (using default dashboard settings)')
    }

    // Ensure directory exists
    ensureDir(paths.lovelace())

    // TODO: Implement dashboard generation
    // const { generateDashboard } = await import('../generators/dashboard-generator.js')
    // await generateDashboard(inventory, dashboardConfig, paths.lovelace())

    console.log('   ⚠️  Dashboard generation pending (use existing workflow for now)')
  }

  // TODO: Implement diff mode
  if (dryRun) {
    console.log('\n📋 Diff preview:')
    console.log('   (diff implementation pending)')
  }

  console.log('\n✨ Generation complete!')
}

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}
