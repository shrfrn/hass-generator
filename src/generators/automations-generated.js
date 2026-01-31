// @ts-check
import { writeFileSync } from 'fs'
import { join } from 'path'
import YAML from 'yaml'
import { cwdPath } from '../paths.js'
import { ensureDir } from '../utils/fs.js'

/**
 * Generate automations/generated.yaml with home-level automations (e.g. KNX sync after startup).
 * @returns {Promise<string[]>} List of generated file paths
 */
export async function generateAutomations() {
	const automationsDir = cwdPath('automations')
	const generatedPath = join(automationsDir, 'generated.yaml')

	ensureDir(automationsDir)

	const automations = [
		{
			id: 'sync_knx_after_startup',
			alias: 'Sync KNX entity states after startup',
			description: 'Re-read KNX state from the bus 60s after HA starts so the dashboard matches physical switches used during boot.',
			trigger: [
				{
					platform: 'event',
					event_type: 'homeassistant_start',
				},
			],
			action: [
				{
					delay: {
						seconds: 60,
					},
				},
				{
					service: 'homeassistant.update_entity',
					target: {
						entity_id: "{{ integration_entities('knx') }}",
					},
				},
			],
		},
	]

	const header = `# Generated automations - DO NOT EDIT
# This file is managed by hass-gen. Manual changes will be overwritten.
`

	writeFileSync(generatedPath, header + YAML.stringify(automations, { lineWidth: 0 }), 'utf-8')

	console.log('  ✓ automations/generated.yaml')

	return ['automations/generated.yaml']
}
