# Code Review: hass-generator

**Date:** January 12, 2026  
**Reviewer:** AI Assistant  
**Version:** 0.2.0

---

## Executive Summary

The `hass-generator` project is a well-structured CLI tool for generating Home Assistant YAML configs and Lovelace dashboards. The codebase follows a clear modular architecture with good separation of concerns. However, there are opportunities for improvement in code reuse, consistency, and maintainability.

**Overall Assessment:** Good foundation with room for DRY improvements, parameter refactoring, and cleanup.

---

## Table of Contents

1. [Critical Issues](#1-critical-issues)
2. [Code Duplication (DRY Violations)](#2-code-duplication-dry-violations)
3. [Unused Exports](#3-unused-exports)
4. [Per-File Analysis](#4-per-file-analysis)
5. [Architecture Observations](#5-architecture-observations)
   - [5.4 Parameter Pattern Issues](#54-parameter-pattern-issues)
6. [Style & Consistency](#6-style--consistency)
   - [6.4 Recommended JSDoc Format](#64-recommended-jsdoc-format)
7. [Recommendations Summary](#7-recommendations-summary)

---

## 1. Critical Issues

### 1.1 Duplicate Key in `paths.js`

**File:** `src/paths.js` (lines 27 & 35)

```js
entities: () => cwdPath('inventory', 'entities.js'),
// ...
entities: () => cwdPath('i18n', 'entities.csv'),
```

The `entities` property is defined twice with different values. The second definition (i18n path) will overwrite the first. This is likely causing bugs where the inventory entities path is inaccessible.

**Severity:** High  
**Fix:** Rename to `entitiesJs` and `entitiesCsv` (or `i18nEntities`)

---

## 2. Code Duplication (DRY Violations)

### 2.1 `ensureDir()` - Duplicated 2x

**Locations:**
- `src/commands/generate.js:197-201`
- `src/commands/inventory.js:91-95`

Both are identical:
```js
function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}
```

**Recommendation:** Create a shared utility in `src/utils/fs.js` or add to `paths.js`:
```js
export function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}
```

### 2.2 `sanitizeFileName()` - Duplicated 3x

**Locations:**
- `src/generators/area-package.js:48-50`
- `src/generators/floor-package.js:36-38`
- `src/generators/label-package.js:36-38`

All identical:
```js
function sanitizeFileName(str) {
  return str.replace(/[^a-z0-9_]/gi, '_').toLowerCase()
}
```

**Recommendation:** Export from `yaml-utils.js` or a new `src/utils/strings.js`

### 2.3 `extractPrefix()` - Duplicated 4x

**Locations:**
- `src/generators/area-package.js:33-46`
- `src/generators/floor-package.js:67-80`
- `src/generators/scene-template-package.js:71-84`
- `src/generators/dashboard/data.js:107-120`

All nearly identical logic to extract area prefix from entity IDs.

**Recommendation:** Export from a shared module (e.g., `src/utils/entity-utils.js`)

### 2.4 `parseCsvLine()` - Duplicated 2x

**Locations:**
- `src/i18n/index.js:66-92`
- `src/i18n/merge-csv.js:266-292`

Identical CSV parsing logic.

**Recommendation:** Create `src/utils/csv.js` with shared CSV utilities

### 2.5 Template-Agnostic Utilities (Shared) vs Template-Specific Code (Keep Separate)

The `bubble/` and `bubble-views/` renderers share ~60% similar code. However, most of this duplication is **intentional** - templates should be self-contained to allow independent evolution.

**Analysis:**

| Function | Template-Specific? | Recommendation |
|----------|-------------------|----------------|
| `buildSeparator()` | ✅ Yes (bubble-card) | Keep in each template |
| `buildSceneGrid()` | ✅ Yes (bubble-card) | Keep in each template |
| `buildLightsGrid()` | ✅ Yes (bubble-card) | Keep in each template |
| `buildLightCard()` | ✅ Yes (bubble-card) | Keep in each template |
| `buildClimateCard()` | ✅ Yes (bubble-card) | Keep in each template |
| `buildOtherGrid()` | ✅ Yes (bubble-card) | Keep in each template |
| `createTranslationHelpers()` | ❌ No (wraps translator) | **Extract to shared** |
| `formatEntityName()` | ❌ No (string formatting) | **Extract to shared** |
| `wrapWithUserCondition()` | ❌ No (HA conditional card) | **Extract to shared** |

**Rationale:** If a future `mushroom` template is added, it would have completely different card builders (different `type`, structure, options). Sharing bubble-card builders would create false coupling.

**Recommendation:** Extract only these **truly template-agnostic** utilities to `src/generators/dashboard/shared.js`:

```js
// Template-agnostic - works with any card type
export function createTranslationHelpers(translator) { ... }
export function formatEntityName(entityId, name) { ... }
export function wrapWithUserCondition(card, visibleToUsers) { ... }
```

### 2.8 `extractFirstName()` - Duplicated 2x

**Locations:**
- `src/generators/home-package.js:115-117`
- `src/generators/users-package.js:51-53`

**Recommendation:** Add to shared string utilities

---

## 3. Unused Exports

Several functions are exported but never imported elsewhere:

| File | Export | Status |
|------|--------|--------|
| `websocket.js` | `getHaVersion()` | Used only in `transform.js` ✓ |
| `naming-check.js` | `buildNamingReport()` | Called internally, no external usage |
| `i18n/index.js` | `TRANSLATABLE_DOMAINS` | Not imported elsewhere |
| `i18n/index.js` | `EXCLUDED_SCENE_SUFFIXES` | Not imported elsewhere |
| `dashboard/data.js` | `extractPrefix()` | Only used internally |

**Recommendation:** Audit all exports and remove `export` from functions only used within their own module.

---

## 4. Per-File Analysis

### 4.1 `src/commands/inventory.js`

**Lines 178-280: Type definitions embedded as code**

The `writeConfigTypes()` function contains a large string literal (~100 lines) of TypeScript type definitions. This is data, not logic.

**Recommendation:** Move to `templates/types/config.d.ts.template` and read at runtime:
```js
const template = readFileSync(join(templatesDir, 'types', 'config.d.ts'), 'utf-8')
writeFileSync(filePath, template)
```

### 4.2 `src/commands/generate.js`

**Function too long:** `generate()` is 160 lines handling both YAML and dashboard generation.

**Recommendation:** Split into:
- `generateYamlPackages(inventory, config)` 
- `generateDashboards(inventory, config, options)`
- Keep `generate()` as orchestrator

**Scene templates in areas:** Template scenes (e.g., `scene.lr_template`) may be included in generated area files.

**Recommendation:** Filter out template scenes in `area-package.js`:
```js
const areaScenes = getAreaScenes(scenes, prefix)
  .filter(s => !s.endsWith('_template'))
```

### 4.3 `src/i18n/index.js`

**Magic index for entityId:**
```js
const id = values[0]  // Line 42
```

**Recommendation:** Use a named constant:
```js
const ID_COLUMN = 0
const id = values[ID_COLUMN]
```

**Loop starting at j=1 is fragile:**
```js
for (let j = 1; j < headers.length; j++) {  // Line 48
```

This assumes only the first column is metadata. If additional metadata columns are added (like `status`), this breaks.

**Recommendation:** Define column structure explicitly:
```js
const META_COLUMNS = 1  // or use headers.indexOf('en') as first lang
for (let j = META_COLUMNS; j < headers.length; j++) {
```

### 4.4 `src/i18n/merge-csv.js`

**Good:** Handles CSV edge cases (quoted fields, commas in values)

**Issue:** Similar hardcoded column indices as `index.js`

**Recommendation:** Create shared CSV utilities with named column handling

### 4.5 `src/generators/scene-template-package.js`

**`getAreaLightEntities()` duplicates logic from `area-package.js:buildLightGroup()`**

Both functions apply the same label-based filtering logic for light entities.

**Recommendation:** Extract shared `filterLightEntities(area, entities, areaConfig, globalConfig)` function

### 4.6 `src/generators/yaml-utils.js`

**Good:** Clean YAML serialization without external dependencies  
**Good:** Proper handling of YAML edge cases (on/off, quoted strings)

**Minor:** `generateHeader()` uses old name "hass-data-generator" instead of "hass-generator"

### 4.7 `src/websocket.js`

**Global state:** Module-level variables (`ws`, `pendingCommands`, `messageId`)

This works for a CLI but could cause issues if the module is imported multiple times or tests need isolation.

**Minor issue for now** - acceptable for CLI usage.

### 4.8 `src/transform.js`

**Good:** Clean transformation logic  
**Good:** Defensive programming with fallbacks for optional data

### 4.9 `src/commands/ship.js`

**Deploy script path inconsistency:**
```js
const deployScript = join(cwd, 'deploy.sh')  // Line 42
```

But the script is actually at `scripts/deploy.sh` per the init template.

**Recommendation:** Check both locations or use `paths.js`:
```js
const deployScript = paths.deployScript?.() || join(cwd, 'scripts', 'deploy.sh')
```

### 4.10 Dashboard Renderers

**`bubble/renderer.js` and `bubble-views/renderer.js`**

~60% of code appears duplicated between these templates. However, this is **by design**.

**Why duplication is acceptable here:**

1. **Template Independence:** Each template should be self-contained. A `mushroom` template would need completely different card builders.
2. **Evolution:** Templates can evolve independently without breaking each other.
3. **The duplication is coincidental** - both happen to use bubble-card, not a design requirement.

**What SHOULD be extracted:** Only truly template-agnostic utilities:
- `createTranslationHelpers()` - wraps translator object
- `formatEntityName()` - pure string formatting
- `wrapWithUserCondition()` - Home Assistant conditional card pattern (works with any card type)

**Recommendation:** Create `src/generators/dashboard/shared.js` with only these three functions. Keep all bubble-card specific builders (`buildSeparator`, `buildLightCard`, etc.) in their respective templates.

---

## 5. Architecture Observations

### 5.1 Strengths

1. **Clear module boundaries:** Commands, generators, utilities are well-separated
2. **No class-based patterns:** Follows functional programming style ✓
3. **Consistent file naming:** kebab-case for files, camelCase for functions
4. **Good error messages:** User-friendly console output with emojis
5. **Template pattern:** Dashboard templates are pluggable via dynamic imports
6. **i18n support:** Built-in translation system with CSV-based translations

### 5.2 Areas for Improvement

1. **No test coverage:** `npm test` returns "No tests yet"
2. **No linting configured:** Missing ESLint/Prettier setup
3. **Mixed async patterns:** Some functions are async without needing to be
4. **No input validation:** Config files are trusted without schema validation

### 5.3 Suggested Module Structure

```
src/
├── commands/
│   ├── generate.js
│   ├── init.js
│   ├── inventory.js
│   └── ship.js
├── generators/
│   ├── dashboard/
│   │   ├── shared.js        # NEW: Template-agnostic utilities only
│   │   ├── templates/
│   │   │   ├── bubble/      # Self-contained template
│   │   │   └── bubble-views/# Self-contained template
│   │   ├── data.js
│   │   └── index.js
│   ├── yaml/               # NEW: Group YAML generators
│   │   ├── area-package.js
│   │   ├── floor-package.js
│   │   ├── home-package.js
│   │   ├── label-package.js
│   │   ├── scene-template-package.js
│   │   └── users-package.js
│   └── yaml-utils.js
├── i18n/
│   └── ...
├── utils/                  # NEW: Shared utilities
│   ├── csv.js
│   ├── entity.js
│   ├── fs.js
│   └── strings.js
├── validation/
│   └── ...
├── fetchers.js
├── paths.js
├── transform.js
└── websocket.js
```

### 5.4 Parameter Pattern Issues

Several functions accept 5-7 parameters, indicating design issues:

| Function | Params | Location |
|----------|--------|----------|
| `buildAreaData()` | **7** | `dashboard/data.js:122` |
| `buildOtherList()` | **6** | `dashboard/data.js:222` |
| `buildMainView()` | **6** | `bubble-views/renderer.js:59` |
| `buildPreviewCard()` | **6** | `bubble-views/renderer.js:251` |
| `buildAreaPackage()` | **6** | `area-package.js:52` |
| `buildLightGroup()` | **5** | `area-package.js:99` |

#### Problem Patterns Identified

| Pattern | Example | Issue |
|---------|---------|-------|
| **Redundant unpacking** | `buildMainView(areaDataList, dashboardName, ..., config)` | Values extracted from `config` passed alongside `config` itself |
| **Data in context object** | `buildPreviewCard(area, prefix, areaData, ...)` | `area` and `prefix` already in `areaData` |
| **Two config sources** | `buildAreaData(..., areaConfig, generatorAreaConfig, ...)` | Confusion about which config provides what |
| **Computed values as params** | `buildOtherList(..., acEntity, fanEntity, ...)` | Values computed immediately before and passed through |

#### Recommended Solution: Structured Context Objects

Group parameters by **lifecycle and responsibility** rather than creating a single bag of properties:

```js
/**
 * @typedef {Object} InventoryContext
 * @property {Map} entityMap - Entities grouped by area_id
 * @property {Map} sceneMap - Scenes grouped by area_id  
 * @property {Array} allScenes - All scene entities
 */

/**
 * @typedef {Object} AreaContext
 * @property {Object} area - The area object from HA
 * @property {string} prefix - Area prefix (e.g., "lr_")
 * @property {Array} entities - Entities in this area
 * @property {Array} scenes - Scenes in this area
 */

/**
 * @typedef {Object} AreaConfigContext
 * @property {Set} excludedLights
 * @property {Array} includedLights
 * @property {Object} dimmableCompanions
 */
```

**Before:**
```js
function buildAreaData(area, prefix, entityMap, sceneMap, areaConfig, generatorAreaConfig, allScenes) {
  // 7 params - mixed concerns
}
```

**After:**
```js
function buildAreaData(areaCtx, configCtx, inventoryCtx) {
  const { area, prefix, entities, scenes } = areaCtx
  const { excludedLights, includedLights, dimmableCompanions } = configCtx
  // 3 cohesive contexts
}
```

#### Benefits of Structured Contexts

| Metric | Improvement |
|--------|-------------|
| **Extendability** | Add fields to context without signature changes |
| **Decoupling** | Clear boundaries between data domains |
| **Testability** | Mock specific contexts independently |
| **Signature Stability** | New features = new context fields, not new params |

#### Context Lifecycle Guidelines

| Context | Lifecycle | Build Location |
|---------|-----------|----------------|
| `InventoryContext` | Once per run | Top of `prepareAllAreaData()` |
| `AreaContext` | Once per area | In the area iteration loop |
| `ConfigContext` | Once per area | Merge both configs in the area loop |

**Key principle:** Merge `areaConfig` (dashboard) and `generatorAreaConfig` (yaml) into a single `ConfigContext` BEFORE passing to builders. Don't thread two config objects through the call chain.

---

## 6. Style & Consistency

### 6.1 Good Practices Observed

- ✓ Single quotes for strings
- ✓ No semicolons (mostly)
- ✓ Trailing commas in objects
- ✓ `export function` for module functions
- ✓ Early returns in conditionals
- ✓ Good function naming (`build...`, `extract...`, `transform...`)

### 6.2 Inconsistencies

| Issue | Location | Example |
|-------|----------|---------|
| Some files use `@ts-check`, others don't | Various | Add consistently |
| Mixed `existsSync` checks | Multiple files | Some use early return, some use if blocks |
| Inconsistent spacing | Various | Some files have blank lines between functions, others don't |
| Some semicolons present | `paths.js`, `yaml-utils.js` | Minor but noticeable |

### 6.3 Missing JSDoc

Several public functions lack JSDoc comments:
- `src/fetchers.js` - all functions
- `src/transform.js` - all functions  
- `src/generators/home-package.js` - main function

### 6.4 Recommended JSDoc Format

Use this standardized format for all exported functions:

#### Basic Function

```js
/**
 * Brief description of what the function does
 * @param {string} paramName - What this param is for
 * @param {object[]} items - Array of item objects
 * @returns {string} What is returned
 */
export function myFunction(paramName, items) {
```

#### Function with Options Object

```js
/**
 * Generate YAML packages and dashboards
 * @param {object} options - Generation options
 * @param {boolean} [options.dryRun] - Show diff without writing
 * @param {boolean} [options.force] - Skip confirmation prompts
 * @param {string} [options.lang] - Language code for translations
 * @returns {Promise<void>}
 */
export async function generate(options = {}) {
```

Or use inline object type for simpler cases:

```js
/**
 * @param {{ dryRun?: boolean, force?: boolean, lang?: string }} options
 */
export async function generate(options = {}) {
```

#### Context Objects (for structured contexts)

```js
/**
 * @typedef {Object} AreaContext
 * @property {Object} area - The area object from HA
 * @property {string} prefix - Area prefix (e.g., "lr_")
 * @property {Array} entities - Entities in this area
 */

/**
 * Build area data for dashboard generation
 * @param {AreaContext} areaCtx - Area context
 * @param {ConfigContext} configCtx - Merged configuration
 * @returns {Object} Area data with lights, scenes, etc.
 */
function buildAreaData(areaCtx, configCtx) {
```

#### Key Conventions

| Element | Convention |
|---------|------------|
| Asterisk alignment | Align `*` with second char of `/**` |
| Optional params | Use `[brackets]` or `?` in type (`{boolean?}` or `[options.flag]`) |
| Descriptions | Start with capital, no trailing period |
| `@returns` | Always include for non-void functions |
| Private functions | JSDoc optional, but recommended for complex logic |

---

## 7. Recommendations Summary

### Priority 1: Critical Fixes

1. **Fix duplicate `entities` key in `paths.js`** - This is likely causing bugs

### Priority 2: DRY Improvements (Shared Utilities)

2. Extract shared utilities:
   - `ensureDir()` → `src/utils/fs.js`
   - `sanitizeFileName()` → `src/utils/strings.js`
   - `extractPrefix()` → `src/utils/entity.js`
   - `parseCsvLine()` → `src/utils/csv.js`
   - `extractFirstName()` → `src/utils/strings.js`

3. Create `src/generators/dashboard/shared.js` with **template-agnostic utilities only**:
   - `createTranslationHelpers()` - wraps translator
   - `formatEntityName()` - string formatting
   - `wrapWithUserCondition()` - HA conditional cards
   
   ⚠️ Do NOT extract bubble-card specific builders - keep templates self-contained.

### Priority 3: Parameter Refactoring (Structured Contexts)

4. Refactor high-parameter functions using structured context objects:
   - **Merge configs early:** Combine `areaConfig` + `generatorAreaConfig` before passing to builders
   - **Create `InventoryContext`:** Group `entityMap`, `sceneMap`, `allScenes`
   - **Create `AreaContext`:** Group `area`, `prefix`, `areaEntities`, `areaScenes`
   - **Create `ConfigContext`:** Merged config values for the current area
   
   Target: Max 3-4 params per function (context objects count as 1)

### Priority 4: Code Quality

5. Add ESLint configuration
6. Move type definitions template out of code
7. Split `generate()` into `generateYamlPackages()` + `generateDashboards()`
8. Audit and remove unnecessary exports
9. Add `@ts-check` to all files consistently
10. Standardize JSDoc comments on all exported functions (see section 6.4)

### Priority 5: Nice to Have

11. Add unit tests for core utilities
12. Add JSON Schema validation for config files
13. Use named constants for CSV column indices
14. Fix deploy script path in ship.js

---

## Appendix: Files Changed Summary

If all recommendations are implemented, the following files would be affected:

| Action | Files |
|--------|-------|
| **New** | `src/utils/fs.js`, `src/utils/strings.js`, `src/utils/entity.js`, `src/utils/csv.js`, `src/generators/dashboard/shared.js` |
| **Modified (Critical)** | `src/paths.js` (duplicate key fix) |
| **Modified (DRY)** | `src/commands/generate.js`, `src/commands/inventory.js`, `src/generators/*.js`, `src/i18n/*.js` |
| **Modified (Params)** | `src/generators/dashboard/data.js`, `src/generators/area-package.js`, `src/generators/dashboard/templates/bubble-views/renderer.js` |
| **Templates** | Move type definitions to `templates/types/` |

### Key Design Decisions

1. **Template Independence:** Dashboard templates (`bubble/`, `bubble-views/`) remain self-contained. Only truly template-agnostic utilities are shared.

2. **Structured Contexts over Bags:** When grouping parameters into objects, group by lifecycle/responsibility (InventoryContext, AreaContext, ConfigContext) rather than creating a single catch-all object.

3. **Merge Configs Early:** Don't thread two config sources through the call chain. Merge `dashboardConfig` and `generatorConfig` into a single context at the orchestration level.

---

*End of Code Review*

