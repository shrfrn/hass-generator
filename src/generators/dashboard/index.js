// Dashboard generator orchestrator
// Prepares data and delegates rendering to the specified template

import { prepareAllAreaData } from './data.js'
import { loadTemplate, getAvailableTemplates } from './templates/index.js'

/**
 * Generate a dashboard using the specified template
 * @param {object} inventory - The HASS inventory data
 * @param {object} config - Dashboard config (must include 'template' field)
 * @param {object} generatorConfig - Generator config (for dimmable_companions, etc.)
 * @returns {Promise<object>} Lovelace dashboard YAML structure
 */
export async function generateDashboard(inventory, config, generatorConfig = {}) {
  const templateName = config.template

  if (!templateName) {
    const available = getAvailableTemplates().join(', ')
    throw new Error(`Dashboard config must specify 'template'. Available: ${available}`)
  }

  console.log(`\n🎨 Generating dashboard with template: ${templateName}`)

  const template = await loadTemplate(templateName)
  const areaDataList = prepareAllAreaData(inventory, config, generatorConfig)

  console.log(`   Processing ${areaDataList.length} areas...`)

  return template.render(areaDataList, config)
}

// Re-export for convenience
export { getAvailableTemplates }

