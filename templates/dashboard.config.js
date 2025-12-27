// @ts-check
// ============================================================================
// DASHBOARD GENERATOR CONFIG
// ============================================================================
// Purpose: Configures the Lovelace dashboard generator (hass-gen generate)
//
// Key options:
//   template         - Dashboard template ('bubble', 'mushroom')
//   output           - Output file path relative to project root
//   pinned_areas     - Areas shown first on the dashboard (in order)
//   excluded_areas   - Areas hidden from the dashboard entirely
//   excluded_lights  - Lights moved from "Lights" section to "Other" section
//   included_lights  - Entities added to "Lights" section (display only)
//   visible_to_users - Restrict area visibility to specific HA user IDs
//
// This file is never overwritten by the generator.
// ============================================================================

// import { PARENTS } from '../users.js'  // Uncomment to use user groups

/** @type {import('../inventory/types/config.d.ts').DashboardConfig} */
const config = {
  // Schema version - do not change manually
  schemaVersion: 1,

  // Dashboard template to use
  template: 'bubble',

  // Output file path (relative to project root)
  output: 'lovelace/main.yaml',

  // Dashboard view title
  dashboard_name: 'Home',

  // Areas to pin at the top of the dashboard (in order)
  pinned_areas: [],

  // Areas to exclude from the dashboard
  excluded_areas: [],

  // Scene suffix for default tap action (scene.<prefix><suffix>)
  default_scene_suffix: 'standard',

  // Per-area dashboard configuration
  // Browse inventory/entities.js to find entity IDs
  areas: {
    // Example:
    // living_room: {
    //   excluded_lights: ['light.lr_ceiling'],
    //   included_lights: ['switch.lr_outlet'],
    //   visible_to_users: PARENTS,  // Only show to parents
    // },
  },
}

export default config

