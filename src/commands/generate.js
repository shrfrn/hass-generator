// @ts-check
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join, basename } from 'path'
import YAML from 'yaml'
import { paths } from '../paths.js'
import { generateAreaPackages } from '../generators/area-package.js'
import { generateLabelPackages } from '../generators/label-package.js'
import { generateDashboard } from '../generators/dashboard/index.js'

/**
 * @param {{ dryRun?: boolean, force?: boolean, yamlOnly?: boolean, dashboardOnly?: boolean, dashboard?: string }} options
 */
export async function generate(options = {}) {
  const { dryRun, force, yamlOnly, dashboardOnly, dashboard } = options

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

  // Load generator config (for YAML packages)
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
    console.log('\n📄 Generating YAML packages...')

    ensureDir(paths.packages())
    ensureDir(paths.packagesAreas())
    ensureDir(paths.packagesLabels())

    const areaFiles = await generateAreaPackages(inventory, config, paths.packages())
    results.yaml.push(...areaFiles)

    const labelFiles = await generateLabelPackages(inventory, paths.packages())
    results.yaml.push(...labelFiles)

    console.log(`\n   Generated ${results.yaml.length} YAML files`)
  }

  // Generate dashboards
  if (!yamlOnly) {
    const dashboardConfigs = await discoverDashboards(dashboard)

    if (dashboardConfigs.length === 0) {
      console.log('\n⚠️  No dashboard configs found in dashboards/ folder')
      console.log('   Create dashboards/main.config.js to generate a dashboard')
    } else {
      ensureDir(paths.lovelace())

      for (const { name, configPath } of dashboardConfigs) {
        const dashboardModule = await import(configPath)
        const dashboardConfig = dashboardModule.default

        if (!dashboardConfig.template) {
          console.error(`\n❌ Dashboard '${name}' missing 'template' field`)
          continue
        }

        const dashboardYaml = await generateDashboard(inventory, dashboardConfig)

        // Determine output path
        const outputPath = dashboardConfig.output
          ? join(process.cwd(), dashboardConfig.output)
          : join(paths.lovelace(), `${name}.yaml`)

        if (!dryRun) {
          ensureDir(join(outputPath, '..'))
          writeFileSync(outputPath, YAML.stringify(dashboardYaml))
          console.log(`   📝 Written to ${dashboardConfig.output || `lovelace/${name}.yaml`}`)
        }

        results.dashboards.push(name)
      }
    }
  }

  if (dryRun) {
    console.log('\n📋 Diff preview:')
    console.log('   (diff implementation pending)')
  }

  console.log('\n✨ Generation complete!')
}

/**
 * Discover dashboard configs in dashboards/ folder
 * @param {string} [filterName] - Optional dashboard name to filter
 * @returns {Promise<Array<{ name: string, configPath: string }>>}
 */
async function discoverDashboards(filterName) {
  const dashboardsDir = paths.dashboards()

  if (!existsSync(dashboardsDir)) {
    return []
  }

  const files = readdirSync(dashboardsDir)
  const configs = []

  for (const file of files) {
    if (!file.endsWith('.config.js')) continue

    const name = file.replace('.config.js', '')

    // Filter if specific dashboard requested
    if (filterName) {
      const requestedNames = filterName.split(',').map(n => n.trim())
      if (!requestedNames.includes(name)) continue
    }

    configs.push({
      name,
      configPath: join(dashboardsDir, file),
    })
  }

  return configs
}

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}
