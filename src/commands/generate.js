// @ts-check
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join, basename } from 'path'
import YAML from 'yaml'
import { paths } from '../paths.js'
import { generateAreaPackages } from '../generators/area-package.js'
import { generateLabelPackages } from '../generators/label-package.js'
import { generateHomePackage } from '../generators/home-package.js'
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

    const homeFiles = await generateHomePackage(inventory, paths.packages())
    results.yaml.push(...homeFiles)

    // Generate index.yaml
    generatePackageIndex(paths.packages(), results.yaml)

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

        const dashboardYaml = await generateDashboard(inventory, dashboardConfig, config)

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

  // Add manual entries
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

    // Skip comments, dividers, and empty lines
    const trimmed = line.trim()
    const isComment = trimmed.startsWith('#')
    const isDivider = trimmed.startsWith('# ---') || trimmed.startsWith('# ===')

    if (inManualSection && trimmed && !isComment && !isDivider) {
      manualEntries.push(line)
    }
  }

  return manualEntries
}
