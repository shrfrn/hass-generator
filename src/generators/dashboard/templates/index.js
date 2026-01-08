// Dashboard template registry and loader

const TEMPLATES = {
  bubble: () => import('./bubble/renderer.js'),
  'bubble-views': () => import('./bubble-views/renderer.js'),
  // Future templates:
  // mushroom: () => import('./mushroom/renderer.js'),
  // minimal: () => import('./minimal/renderer.js'),
}

/**
 * Get list of available template names
 * @returns {string[]}
 */
export function getAvailableTemplates() {
  return Object.keys(TEMPLATES)
}

/**
 * Load a template renderer by name
 * @param {string} templateName
 * @returns {Promise<{ render: Function }>}
 */
export async function loadTemplate(templateName) {
  const loader = TEMPLATES[templateName]

  if (!loader) {
    const available = getAvailableTemplates().join(', ')
    throw new Error(`Unknown dashboard template: '${templateName}'. Available: ${available}`)
  }

  return loader()
}

