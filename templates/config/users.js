// @ts-check
// ============================================================================
// USER DEFINITIONS
// ============================================================================
// Define user groups for visibility restrictions in dashboard.config.js
// Find user IDs in Home Assistant: Settings → People → [Person] → Advanced
// ============================================================================

// Example user IDs (replace with your actual HA user IDs)
export const ADMIN = ['abc123-your-admin-user-id']
export const PARENTS = ['abc123-parent1-id', 'def456-parent2-id']
export const KIDS = ['ghi789-kid1-id', 'jkl012-kid2-id']
export const ALL = [...PARENTS, ...KIDS]

