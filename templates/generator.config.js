// @ts-check
// ============================================================================
// YAML GENERATOR CONFIG
// ============================================================================
// Purpose: Configures the YAML package generator (hass-gen generate)
// Outputs: packages/areas/*.yaml (light groups, helpers, timers, etc.)
//
// This file is never overwritten by the generator.
// ============================================================================

/** @type {import('./inventory/types/config.d.ts').GeneratorConfig} */
const config = {
  // Schema version - do not change manually
  schemaVersion: 1,

  // ─────────────────────────────────────────────────────────────────────────
  // GLOBAL OPTIONS
  // ─────────────────────────────────────────────────────────────────────────

  // Default vacancy timer duration (when area becomes empty)
  default_vacancy_duration: '00:09:00',

  // Labels to exclude from ALL light groups by default
  // Entities with these labels won't be added to area light groups
  excluded_labels: [],

  // Labels to always include in light groups (overrides excluded_labels)
  included_labels: [],

  // ─────────────────────────────────────────────────────────────────────────
  // PER-AREA OVERRIDES
  // ─────────────────────────────────────────────────────────────────────────
  // Browse inventory/entities.js to find entity IDs and labels
  //
  // Example - all options:
  //   kitchen: {
  //     vacancy_timer_duration: '00:05:00',      // Override vacancy timer
  //     include_in_group: ['switch.kt_cabinet'], // Add entities to light group
  //     exclude_from_group: ['light.kt_notif'],  // Remove from light group
  //     excluded_labels: [],                     // Clear global exclusions for this area
  //     included_labels: ['outdoor'],            // Include outdoor lights in this area
  //   },

  areas: {
    // Add your area overrides here
  },
}

export default config

