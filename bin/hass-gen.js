#!/usr/bin/env node
// @ts-check

import { Command } from 'commander'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'))

const program = new Command()

program
	.name('hass-gen')
	.description('CLI tool for generating Home Assistant YAML configs and dashboards')
	.version(pkg.version)

program
	.command('init [destination]')
	.description('Initialize a new HASS config project with starter files')
	.action(async (destination) => {
		const { init } = await import('../src/commands/init.js')
		await init(destination)
	})

program
	.command('inventory')
	.description('Fetch entity data from Home Assistant and generate types')
	.action(async () => {
		const { inventory } = await import('../src/commands/inventory.js')
		await inventory()
	})

program
	.command('generate')
	.description('Generate YAML packages and dashboards')
	.option('--dry-run', 'Show diff without writing files')
	.option('--force', 'Skip diff confirmation prompts')
	.option('--yaml-only', 'Generate only YAML packages')
	.option('--dashboard-only', 'Generate only dashboards')
	.option('-d, --dashboard <names>', 'Generate specific dashboard(s), comma-separated')
	.option('-l, --lang <code>', 'Language code for translations (e.g., en, he)')
	.action(async (options) => {
		const { generate } = await import('../src/commands/generate.js')
		await generate(options)
	})

program
	.command('ship')
	.description('Generate, commit, and deploy to Home Assistant')
	.option('--full', 'Run inventory before generating')
	.option('--no-deploy', 'Skip deploy.sh execution')
	.action(async (options) => {
		const { ship } = await import('../src/commands/ship.js')
		await ship(options)
	})

program.parse()

