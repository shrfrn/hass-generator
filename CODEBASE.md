# Codebase Documentation for hass-generator

## 1. Project Overview
`hass-generator` is a CLI tool designed to automate the configuration of Home Assistant. It fetches the current state of a Home Assistant instance (inventory), transforms it, and generates YAML configuration packages and Lovelace dashboards based on user-defined templates and rules.

## 2. Directory Structure

```
/
├── bin/
│   └── hass-gen.js           # CLI Entry point
├── src/
│   ├── commands/             # CLI command logic (init, inventory, generate, ship)
│   ├── generators/           # Logic for creating YAML and dashboard files
│   │   ├── dashboard/        # Dashboard generation subsystem
│   │   └── *.js              # Specific package generators (area, label, home, etc.)
│   ├── fetchers.js           # Home Assistant WebSocket API calls
│   ├── transform.js          # Data normalization (Raw API -> Internal Model)
│   ├── websocket.js          # Low-level WebSocket connection management
│   ├── paths.js              # Centralized file path configuration
│   └── validation/           # Naming convention checks
├── templates/                # Boilerplate files for 'init' command
└── generator.config.js       # (User) Configuration for generation logic
```

## 3. Key Concepts & Data Structures

### 3.1 Inventory (The "State")
The "Inventory" is the source of truth, fetched from Home Assistant and stored in `inventory/hass-data.json`.
It contains normalized lists of:
*   `entities`: All states, enriched with registry data.
*   `areas`: Physical spaces in the home.
*   `scenes`: Pre-defined states.
*   `labels`: Tags for organizing entities.
*   `devices`, `floors`, `persons`, `zones`.

### 3.2 Configuration
*   **`generator.config.js`**: Controls YAML package generation (light groups, vacancy timers, global label rules).
*   **`dashboards/*.config.js`**: Controls Lovelace dashboard generation (template selection, navigation structure).

### 3.3 Context (Internal)
Refactored generators use a `Context` object to pass state around without excessive arguments:
```javascript
{
  area: { ... },       // Current area being processed
  entities: [ ... ],   // All entities
  scenes: [ ... ],     // All scenes
  config: {            // Merged configuration
    global: { ... },
    area: { ... }
  },
  prefix: "living_"    // Entity prefix derived for this area
}
```

## 4. Execution Flows

### 4.1 `hass-gen inventory`
1.  **Connect**: `websocket.js` opens connection to Home Assistant.
2.  **Fetch**: `fetchers.js` runs parallel commands (`get_states`, `area_registry/list`, etc.).
3.  **Transform**: `transform.js` normalizes raw API data into the Inventory model.
4.  **Enrich**: `i18n/merge-csv.js` merges new entities with existing translation files.
5.  **Write**: Saves `hass-data.json`, `entities.js`, and TypeScript definition files.

### 4.2 `hass-gen generate`
1.  **Load**: Reads `hass-data.json` and `generator.config.js`.
2.  **Generate Packages** (YAML):
    *   Iterates over `generators/*.js` (area, label, home, etc.).
    *   Each generator produces YAML files in `packages/`.
    *   `yaml-utils.js` handles file writing and header generation.
3.  **Generate Dashboards**:
    *   Discovers `dashboards/*.config.js` files.
    *   Loads the specified template (e.g., `bubble`).
    *   `src/generators/dashboard/data.js` prepares agnostic data (grouping entities by area, filtering lights).
    *   The template renderer produces the final Lovelace YAML.

### 4.3 `hass-gen ship`
1.  **Inventory** (Optional): Runs `hass-gen inventory`.
2.  **Generate**: Runs `hass-gen generate --force`.
3.  **Commit**: Adds all changes to git and commits.
4.  **Deploy**: Executes `scripts/deploy.sh` (usually rsync/scp to the HA server).

## 5. Key Modules Breakdown

### `src/generators/area-package.js`
Generates area-specific packages containing:
*   **Light Group**: Auto-populated based on area assignment + labels + config rules.
*   **Vacancy Timer**: `timer.{prefix}_vacancy`.
*   **Automations Helper**: `input_boolean.{prefix}_pause_automations`.
*   **Scene Selector**: `input_select.{prefix}_active_scene`.

### `src/generators/dashboard/data.js`
The bridge between raw inventory and UI templates.
*   `prepareAllAreaData`: Iterates areas, calculates prefixes.
*   `buildAreaData`: Categorizes entities into `lights`, `scenes`, `fan`, `climate`, and `other`.
*   **Smart Logic**: Handles "Dimmable Companions" (merging a smart bulb with a smart switch into a single UI element).

## 6. Developer Guidelines
*   **Functional Style**: Pure functions, no classes.
*   **Small Functions**: Keep functions under 30 lines.
*   **Prefixing**: Code heavily relies on entity naming conventions (e.g., `light.kitchen_main` -> prefix `kitchen_`).
