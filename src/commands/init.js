// @ts-check
import { copyFileSync, existsSync, mkdirSync, chmodSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const templatesDir = join(__dirname, '..', '..', 'templates')

/**
 * @param {string} [destination] - Optional destination directory
 */
export async function init(destination) {
	const targetDir = destination ? resolve(destination) : process.cwd()

	// Ensure target directory exists
	if (!existsSync(targetDir)) {
		mkdirSync(targetDir, { recursive: true })
	}

	const files = [
		// Config files (root)
		{ src: 'config/.gitignore', dest: '.gitignore' },
		{ src: 'config/generator.config.js', dest: 'generator.config.js' },
		{ src: 'config/users.js', dest: 'users.js' },
		{ src: 'config/package.json', dest: 'package.json' },
		{ src: 'config/.env.example', dest: '.env.example' },
		{ src: 'config/configuration.base.yaml', dest: 'configuration.base.yaml' },

		// Dashboard config (dashboards/)
		{ src: 'config/dashboard.config.js', dest: 'dashboards/main.config.js' },
		{ src: 'config/dashboard.shared.js', dest: 'dashboards/shared.js' },

		// i18n translation files
		{ src: 'i18n/areas.csv', dest: 'i18n/areas.csv' },
		{ src: 'i18n/entities.csv', dest: 'i18n/entities.csv' },
		{ src: 'i18n/ui-strings.csv', dest: 'i18n/ui-strings.csv' },

		// TypeScript types for inventory
		{ src: 'config/inventory/types/config.d.ts', dest: 'inventory/types/config.d.ts' },

		// Shell scripts (scripts/)
		{ src: 'scripts/deploy.sh', dest: 'scripts/deploy.sh', executable: true },
		{ src: 'scripts/ship.sh', dest: 'scripts/ship.sh', executable: true },
		{ src: 'scripts/rebuild.sh', dest: 'scripts/rebuild.sh', executable: true },

		// Generated YAML placeholders
		{ src: 'generated/automations.yaml', dest: 'automations/generated.yaml' },
		{ src: 'generated/scenes.yaml', dest: 'scenes/generated.yaml' },
		{ src: 'generated/scripts.yaml', dest: 'ha-scripts/generated.yaml' },
	]

	console.log(`🏠 Initializing HASS generator project in ${targetDir}...\n`)

	// Create directories
	const dirs = ['inventory/types', 'i18n', 'dashboards', 'scripts', 'packages', 'lovelace', 'automations', 'scenes', 'ha-scripts']

	for (const dir of dirs) {
		const dirPath = join(targetDir, dir)

		if (!existsSync(dirPath)) {
			mkdirSync(dirPath, { recursive: true })
			console.log(`  📁 ${dir}/`)
		}
	}

	console.log('')

	// Copy files
	for (const file of files) {
		const destPath = join(targetDir, file.dest)
		const destDir = dirname(destPath)

		// Ensure destination directory exists
		if (!existsSync(destDir)) {
			mkdirSync(destDir, { recursive: true })
		}

		if (existsSync(destPath)) {
			console.log(`  ⏭️  ${file.dest} (already exists, skipping)`)
			continue
		}

		const srcPath = join(templatesDir, file.src)

		if (!existsSync(srcPath)) {
			console.log(`  ⚠️  ${file.dest} (template not found, skipping)`)
			continue
		}

		copyFileSync(srcPath, destPath)

		if (file.executable) {
			chmodSync(destPath, 0o755)
		}

		console.log(`  ✅ ${file.dest}`)
	}

	console.log('\n✨ Done! Next steps:')
	console.log('   1. cd ' + (destination || '.'))
	console.log('   2. Copy .env.example to .env and add your HASS credentials')
	console.log('   3. Run: npm install')
	console.log('   4. Run: npx hass-gen inventory')
	console.log('   5. Edit generator.config.js and dashboards/main.config.js')
	console.log('   6. Run: npx hass-gen generate')
}
