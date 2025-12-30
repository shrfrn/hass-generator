// Naming consistency checker
// Validates that entities follow area prefix naming conventions

import { writeFileSync } from 'fs'

/**
 * Check naming consistency for all entities
 * @param {object} data - The inventory data
 * @returns {{ prefixes: Map, violations: Array }} Results
 */
export function checkNamingConsistency(data) {
  const { entities } = data
  const entitiesWithArea = entities.filter(e => e.area_id)

  if (entitiesWithArea.length === 0) {
    return { prefixes: new Map(), violations: [] }
  }

  const prefixes = establishAreaPrefixes(entitiesWithArea)
  const violations = findViolations(entitiesWithArea, prefixes)

  return { prefixes, violations }
}

/**
 * Print naming check results to console
 * @param {{ prefixes: Map, violations: Array }} results
 */
export function printNamingReport(results) {
  const { prefixes, violations } = results

  if (violations.length === 0) {
    console.log('  ✓ All entities follow naming conventions')
    return
  }

  const areasWithViolations = new Set(violations.map(v => v.area_id)).size

  console.log(`\n⚠️  Naming violations: ${violations.length} entities in ${areasWithViolations} areas`)

  const byArea = groupBy(violations, 'area_id')

  for (const [areaId, areaViolations] of Object.entries(byArea)) {
    const expectedPrefix = prefixes.get(areaId)
    console.log(`\n   ${areaId} (expected: ${expectedPrefix})`)

    for (const v of areaViolations.slice(0, 5)) {
      console.log(`     - ${v.entity_id}`)
    }

    if (areaViolations.length > 5) {
      console.log(`     ... and ${areaViolations.length - 5} more`)
    }
  }
}

/**
 * Build a JSON report of violations
 * @param {{ prefixes: Map, violations: Array }} results
 * @returns {object} Report object
 */
export function buildNamingReport(results) {
  const { prefixes, violations } = results
  const areasWithViolations = new Set(violations.map(v => v.area_id))

  const prefixesObject = {}

  for (const [areaId, prefix] of prefixes) {
    prefixesObject[areaId] = prefix
  }

  return {
    generated_at: new Date().toISOString(),
    summary: {
      total_areas_checked: prefixes.size,
      areas_with_violations: areasWithViolations.size,
      total_violations: violations.length,
    },
    area_prefixes: prefixesObject,
    violations,
  }
}

/**
 * Write naming violations to a JSON file
 * @param {{ prefixes: Map, violations: Array }} results
 * @param {string} filePath - Output file path
 */
export function writeNamingReport(results, filePath) {
  const { violations } = results

  if (violations.length === 0) return

  const report = buildNamingReport(results)
  writeFileSync(filePath, JSON.stringify(report, null, 2))
  console.log(`   📄 ${filePath}`)
}

function establishAreaPrefixes(entities) {
  const prefixCounts = new Map()

  for (const entity of entities) {
    const { area_id, entity_id } = entity
    const prefix = extractPrefix(entity_id)

    if (!prefix) continue

    if (!prefixCounts.has(area_id)) {
      prefixCounts.set(area_id, new Map())
    }

    const areaCounts = prefixCounts.get(area_id)
    areaCounts.set(prefix, (areaCounts.get(prefix) || 0) + 1)
  }

  const prefixes = new Map()

  for (const [areaId, counts] of prefixCounts) {
    let maxCount = 0
    let mostCommon = null

    for (const [prefix, count] of counts) {
      if (count > maxCount) {
        maxCount = count
        mostCommon = prefix
      }
    }

    if (mostCommon) {
      prefixes.set(areaId, mostCommon)
    }
  }

  return prefixes
}

function extractPrefix(entityId) {
  const name = entityId.split('.')[1]

  if (!name) return null

  const underscoreIndex = name.indexOf('_')

  if (underscoreIndex === -1) return null

  return name.substring(0, underscoreIndex + 1)
}

function findViolations(entities, areaPrefixes) {
  const violations = []

  for (const entity of entities) {
    const { entity_id, area_id } = entity
    const expectedPrefix = areaPrefixes.get(area_id)

    if (!expectedPrefix) continue

    const actualPrefix = extractPrefix(entity_id)

    if (actualPrefix !== expectedPrefix) {
      violations.push({
        entity_id,
        area_id,
        expected_prefix: expectedPrefix,
        actual_prefix: actualPrefix || '(no prefix)',
      })
    }
  }

  return violations
}

function groupBy(arr, key) {
  const result = {}

  for (const item of arr) {
    const k = item[key]

    if (!result[k]) result[k] = []

    result[k].push(item)
  }

  return result
}

