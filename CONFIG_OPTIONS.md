# Configuration Options Reference

This document describes all configuration options for the hass-generator tool.

## Table of Contents

- [Home Assistant Base Config (`configuration.base.yaml`)](#home-assistant-base-config)
- [YAML/Entity Generation (`generator.config.js`)](#yamlentity-generation)
  - [Global Options](#global-options)
  - [Per-Area Options](#per-area-options)
  - [Usage Examples](#yaml-usage-examples)
- [Dashboard Generation](#dashboard-generation)
  - [Shared Config (`dashboards/shared.js`)](#shared-dashboard-config)
  - [Dashboard-Specific Config (`dashboards/*.config.js`)](#dashboard-specific-config)
  - [Per-Area Dashboard Options](#per-area-dashboard-options)
  - [Template-Specific Options](#template-specific-options)
  - [Usage Examples](#dashboard-usage-examples)
- [User Groups (`users.js`)](#user-groups)
- [Multi-Language Dashboards](#multi-language-dashboards)
- [Common Patterns](#common-patterns)

---

## Home Assistant Base Config

**File:** `configuration.base.yaml`  
**Output:** `configuration.yaml`

The generator rebuilds `configuration.yaml` from scratch on every run using `configuration.base.yaml` as the source template. The `lovelace.dashboards` section is automatically appended based on your dashboard configs.

**Why this approach:**
- No stale dashboard entries (full rebuild removes old dashboards automatically)
- Single source of truth for static HA config
- Dashboard registration always matches your `*.config.js` files

**What to edit:**
- ✅ Edit `configuration.base.yaml` for static config changes (integrations, resources, etc.)
- ❌ Don't edit `configuration.yaml` directly (it gets overwritten)

**Example `configuration.base.yaml`:**

```yaml
default_config:

frontend:
  themes: !include_dir_merge_named themes

automation: !include automations.yaml
script: !include scripts.yaml
scene: !include scenes.yaml

homeassistant:
  packages: !include packages/index.yaml

lovelace:
  mode: yaml
  resources:
    - url: /hacsfiles/Bubble-Card/bubble-card.js
      type: module
    - url: /hacsfiles/lovelace-mushroom/mushroom.js
      type: module
# dashboards section is appended automatically by the generator
```

---

## YAML/Entity Generation

**File:** `generator.config.js`  
**Command:** `hass-gen generate`  
**Outputs:** `packages/areas/*.yaml`

Configures the generation of YAML packages for each area, including light groups, helpers, timers, and scene selectors.

### Global Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `schemaVersion` | `number` | `1` | Schema version. Do not change manually. |
| `default_vacancy_duration` | `string` | `'00:10:00'` | Default vacancy timer duration in `HH:MM:SS` format. Applied to all areas unless overridden. |
| `excluded_labels` | `string[]` | `[]` | Labels to exclude from ALL light groups by default. Entities with these labels won't be added to area light groups. |

### Per-Area Options

Defined under `areas.<area_id>`:

| Option | Type | Description |
|--------|------|-------------|
| `vacancy_timer_duration` | `string` | Override the global vacancy timer for this area. Format: `HH:MM:SS`. |
| `include_in_group` | `string[]` | Entity IDs to explicitly add to the light group (e.g., switches acting as lights). |
| `exclude_from_group` | `string[]` | Entity IDs to exclude from the light group. |
| `excluded_labels` | `string[]` | Labels to exclude for this area. **Overrides** (replaces) global `excluded_labels`. |
| `included_labels` | `string[]` | Labels to include for this area. **Overrides** global `excluded_labels` for matching entities. |
| `dimmable_companions` | `object` | **Deprecated.** Use `syncedEntities` instead. |
| `syncedEntities` | `object` | Synced entity fixtures. Generates sync automations, template lights, and groups. See below. |

#### Synced Entities

Configure fixtures where multiple entities should sync together (e.g., KNX wall switches + smart bulbs):

```javascript
syncedEntities: {
  fixture_id: {
    name: 'Fixture Display Name',
    icon: 'mdi:wall-sconce-round',  // Optional: override HA default icon
    power: 'light.power_entity',  // or null if always powered
    default_brightness: 254,       // Optional: hardware power-on default (default: 255)
    entities: [
      { entity_id: 'light.relay', sync: true },
      { entity_id: 'light.bulb', sync: true, controls: 'dimmable' },
      {
        device_id: 'remote-device-id',
        name: 'remote_name',  // Used in automation naming
        sync: false,
        blueprint: ikeaE2201Base('light.fixture_id'),
      },
    ],
  },
}
```

**Fixture Properties:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | required | Display name for the fixture |
| `icon` | `string` | — | Optional MDI icon (e.g. `'mdi:wall-sconce-round'`). Applied to the generated template light and dashboard card; if omitted, HA default is used. |
| `power` | `string \| null` | required | Power control entity. `null` = always on, entity_id = generates template light with boot-wait |
| `default_brightness` | `number` | `254` | Hardware power-on brightness. Used for input_number initial value and turn_on reset. |
| `entities` | `SyncedEntity[]` | required | Entities in this fixture |

**Entity Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `entity_id` | `string` | Entity ID (for sync entities) |
| `sync` | `boolean` | Whether entity participates in bidirectional sync |
| `controls` | `string \| string[]` | Control capabilities. Default: `['on', 'off']` |

**Device Properties (for remotes):**

| Property | Type | Description |
|----------|------|-------------|
| `device_id` | `string` | Z2M device ID |
| `name` | `string` | Name used in automation ID and alias (e.g., `shahar` → `fixture_remote_shahar`) |
| `sync` | `boolean` | Always `false` for devices |
| `blueprint` | `object` | Blueprint configuration |

**Controls Shorthand:**

| Value | Resolves To |
|-------|-------------|
| (omitted) | `['on', 'off']` |
| `'dimmable'` | `['on', 'off', 'brightness']` |
| `'tunable'` | `['on', 'off', 'brightness', 'color_temp']` |
| `'rgb'` | `['on', 'off', 'brightness', 'rgb']` |

**Naming Convention:**

All generated components follow a consistent naming pattern:

| Component | ID/Name |
|-----------|---------|
| Template light | `{fixture_id}` |
| Sync automation | `{fixture_id}_sync` |
| Blueprint automation | `{fixture_id}_remote_{name}` |
| Event throttler script | `{fixture_id}_ev_throttler` |
| Brightness helper | `{fixture_id}_brightness` |

**Labels:**

All generated automations and scripts receive two labels:
- `auto_generated` - Identifies generator-created entities
- `fixture_{fixture_id}` - Groups all components of a fixture

**What Gets Generated:**

| `power` | light entities | Generated |
|---------|----------------|-----------|
| entity_id | any | Template light + light group + input_number helper + event throttler script + sync automation |
| null | any | Template light + light group + sync automation |

**For all fixtures, the generator creates:**

1. **`light.{fixture_id}_group`** - Light group containing all light entities in the fixture. Always created, even for single bulbs. The sync automation triggers on this group (not individual bulbs) to prevent race conditions.

2. **`light.{fixture_id}` (template light)** - Wrapper that targets the group. Provides a consistent entity ID for scenes/automations/dashboards.

3. **Sync automation** (`{fixture_id}_sync`) - Keeps the group and non-light entities (switches) in sync. Uses `mode: restart` for responsiveness and filters targets by state to avoid redundant commands.

**When `power` is set with dimmable entities, the generator additionally creates:**

1. **`input_number.{fixture_id}_brightness`** - Tracks brightness internally to avoid stale values from Zigbee bulbs after power cycles. Initial value: `default_brightness` (default: 254).

2. **`script.{fixture_id}_ev_throttler`** - Event throttler with `mode: single`. Rejects concurrent calls to prevent command flooding when rapidly dimming. Sequence:
   - Wait for bulbs to become available (5s timeout)
   - Send brightness to bulbs
   - Update the input_number helper

3. **Template light enhancements** - Uses the helper for `level_template` (not the bulb's potentially stale brightness). The `turn_on` action resets the helper to `default_brightness`. The `set_level` action routes through the event throttler script.

> **Note:** Configure Z2M power-on brightness to match your `default_brightness` value for consistent behavior.

### YAML Usage Examples

#### Example 1: Basic Setup with Global Label Exclusion

Exclude outdoor and flood lights from all light groups by default:

```javascript
// generator.config.js
const config = {
  schemaVersion: 1,
  default_vacancy_duration: '00:09:00',
  excluded_labels: ['outdoor', 'flood_light'],
  areas: {},
}

export default config
```

#### Example 2: Including Switches in Light Groups

Some switches control lights but aren't in the `light` domain. Add them explicitly:

```javascript
const config = {
  schemaVersion: 1,
  default_vacancy_duration: '00:09:00',
  excluded_labels: ['outdoor'],

  areas: {
    living_room: {
      // Switch that controls a light fixture
      include_in_group: ['switch.lr_soc_e', 'switch.lr_cabinet_lights'],
    },

    kitchen: {
      // Under-cabinet LED strip controlled via switch
      include_in_group: ['switch.kt_led_strip'],
    },
  },
}

export default config
```

#### Example 3: Synced Entity Fixtures

When a wall switch/relay controls power to smart bulbs, configure them as synced fixtures:

```javascript
const config = {
  schemaVersion: 1,
  default_vacancy_duration: '00:09:00',
  excluded_labels: [],

  areas: {
    bedroom: {
      // Wall switch always powered, bulb needs sync
      syncedEntities: {
        mb_standing_lamp: {
          name: 'Bedroom Standing Lamp',
          power: null,  // Switch doesn't cut power to bulb
          entities: [
            { entity_id: 'switch.mb_soc', sync: true },
            { entity_id: 'light.mb_soc_bulb', sync: true, controls: 'dimmable' },
          ],
        },
      },
    },

    office: {
      // KNX relay controls power to IKEA bulbs
      syncedEntities: {
        ofc_wall_light: {
          name: 'Office Wall Light',
          power: 'light.ofc_lt_walls',  // Generates template light with boot-wait
          entities: [
            { entity_id: 'light.ofc_lt_walls', sync: true },
            { entity_id: 'light.ofc_lt_wall_bulbs', sync: true, controls: 'tunable' },
          ],
        },
      },
    },
  },
}

export default config
```

#### Example 4: Outdoor Areas with Special Handling

Patio/yard areas where you want the globally-excluded outdoor lights:

```javascript
const config = {
  schemaVersion: 1,
  default_vacancy_duration: '00:09:00',
  excluded_labels: ['outdoor', 'flood_light'],

  areas: {
    // Indoor areas inherit global exclusions (no outdoor lights)
    living_room: {},
    kitchen: {},

    // Patio: bring back outdoor lights for this area only
    front_yard: {
      included_labels: ['outdoor'],
    },

    // Backyard: include both outdoor AND flood lights
    backyard: {
      excluded_labels: [],  // Clear all global exclusions
    },
  },
}

export default config
```

#### Example 5: Custom Vacancy Timers per Area

Different rooms need different timeout behaviors:

```javascript
const config = {
  schemaVersion: 1,
  default_vacancy_duration: '00:10:00',  // 10 min default
  excluded_labels: [],

  areas: {
    // Bathroom: short timeout
    bathroom: {
      vacancy_timer_duration: '00:03:00',
    },

    // Office: longer timeout for work sessions
    office: {
      vacancy_timer_duration: '00:30:00',
    },

    // Storage/utility: very short timeout
    laundry_room: {
      vacancy_timer_duration: '00:02:00',
    },
  },
}

export default config
```

#### Example 6: Excluding Specific Lights

Remove lights from the group that shouldn't be controlled together:

```javascript
const config = {
  schemaVersion: 1,
  default_vacancy_duration: '00:09:00',
  excluded_labels: [],

  areas: {
    living_room: {
      // Don't include these in "All Lights" control
      exclude_from_group: [
        'light.lr_accent_led',   // Accent lighting (always on)
        'light.lr_tv_bias',      // TV backlight (separate control)
      ],
    },

    bedroom: {
      exclude_from_group: [
        'light.mb_nightlight',   // Always dim, shouldn't turn off with others
      ],
    },
  },
}

export default config
```

#### Example 7: Complete Real-World Config

A comprehensive configuration combining multiple patterns:

```javascript
// generator.config.js
const config = {
  schemaVersion: 1,
  default_vacancy_duration: '00:09:00',
  excluded_labels: ['outdoor', 'flood_light', 'notification'],

  areas: {
    living_room: {
      include_in_group: ['switch.lr_soc_e'],
      exclude_from_group: ['light.lr_tv_bias'],
    },

    bedroom: {
      vacancy_timer_duration: '00:05:00',
      exclude_from_group: ['light.mb_nightlight'],
      syncedEntities: {
        mb_standing_lamp: {
          name: 'Bedroom Standing Lamp',
          power: null,
          entities: [
            { entity_id: 'switch.mb_soc', sync: true },
            { entity_id: 'light.mb_soc_bulb', sync: true, controls: 'dimmable' },
          ],
        },
      },
    },

    office: {
      vacancy_timer_duration: '00:30:00',
      include_in_group: ['switch.ofc_monitor_lights'],
      syncedEntities: {
        ofc_wall_light: {
          name: 'Office Wall Light',
          power: 'light.ofc_lt_walls',
          entities: [
            { entity_id: 'light.ofc_lt_walls', sync: true },
            { entity_id: 'light.ofc_lt_wall_bulbs', sync: true, controls: 'tunable' },
          ],
        },
      },
    },

    bathroom: {
      vacancy_timer_duration: '00:03:00',
    },

    front_yard: {
      included_labels: ['outdoor'],
    },
  },
}

export default config
```

---

## Dashboard Generation

Dashboard configuration is split into:

1. **Shared config** (`dashboards/shared.js`) - Common settings across all dashboards
2. **Dashboard-specific configs** (`dashboards/<name>.config.js`) - Per-dashboard settings

### Shared Dashboard Config

**File:** `dashboards/shared.js`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `schemaVersion` | `number` | `1` | Schema version. Do not change manually. |
| `language` | `string` | `'en'` | Language code for translations (from `i18n/*.csv`). |
| `pinned_areas` | `string[]` | `[]` | Areas to pin at the top of the dashboard, in display order. |
| `excluded_areas` | `string[]` | `[]` | Areas to completely hide from the dashboard. |
| `default_scene_suffix` | `string` | `'standard'` | Scene suffix for default tap action (`scene.<prefix><suffix>`). |
| `areas` | `object` | `{}` | Per-area dashboard configuration. See below. |

### Dashboard-Specific Config

**File:** `dashboards/<name>.config.js`

Each dashboard config file imports and extends the shared config:

| Option | Type | Description |
|--------|------|-------------|
| `template` | `'bubble'` \| `'bubble-views'` \| `'mushroom'` | Dashboard template to use. |
| `output` | `string` | Output file path relative to project root. |
| `dashboard_name` | `string` | Dashboard view title displayed in HA. |
| `dashboard_path` | `string` | URL path for HA registration (e.g., `'home-main'`). |
| `dashboard_title` | `string` | Title shown in HA sidebar. |
| `dashboard_icon` | `string` | MDI icon for sidebar (e.g., `'mdi:view-dashboard'`). |
| `show_in_sidebar` | `boolean` | Whether to show in HA sidebar. Default: `true`. |

### Per-Area Dashboard Options

Defined under `areas.<area_id>` in shared or dashboard-specific config:

| Option | Type | Description |
|--------|------|-------------|
| `excluded_lights` | `string[]` | Light entity IDs to exclude from the Lights section. Moved to "Other" section. |
| `included_lights` | `string[]` | Entity IDs to add to the Lights section (e.g., switches that control lights). |
| `included_scenes` | `string[]` | Scene entity IDs from other areas to show in this area's view. |
| `excluded_scenes` | `string[]` | Scene entity IDs to hide from this area (show in another area instead). |
| `visible_to_users` | `string[]` | HA user IDs that can see this area. Omit to show to all users. |

### Template-Specific Options

#### Bubble Template (`bubble`)

Basic popup-based dashboard using Bubble Card. No additional options beyond the base config.

#### Bubble-Views Template (`bubble-views`)

Multi-view dashboard with HA native views and additional cards:

| Option | Type | Description |
|--------|------|-------------|
| `home_card` | `object` | Home card configuration with quick action buttons. |
| `home_card.sub_buttons` | `SubButton[]` | Array of quick action buttons. |
| `presence_card` | `object` | Presence card showing who's home. |
| `presence_card.entity` | `string` | Main presence entity (e.g., `binary_sensor.anyone_home`). |
| `presence_card.users` | `PresenceUser[]` | Individual user presence indicators. |

**SubButton Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `entity` | `string` | Entity ID for the button. |
| `icon` | `string` | MDI icon override. |
| `name` | `string` | Display name override. |
| `action` | `'tap'` \| `'hold'` | Action type. Default: `'tap'`. Use `'hold'` for destructive actions. |

**PresenceUser Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Display name. |
| `entity` | `string` | Binary sensor entity for presence. |
| `icon` | `string` | MDI icon for the user. |

### Dashboard Usage Examples

#### Example 1: Basic Shared Config

```javascript
// dashboards/shared.js
const config = {
  schemaVersion: 1,
  language: 'en',

  // Most-used areas first
  pinned_areas: [
    'living_room',
    'kitchen',
    'bedroom',
  ],

  // Hide system/utility areas
  excluded_areas: ['home_assistant', 'network_closet'],

  default_scene_suffix: 'standard',
  areas: {},
}

export default config
```

#### Example 2: Bubble Dashboard Config

```javascript
// dashboards/main.config.js
import globalConfig from './shared.js'

const config = {
  ...globalConfig,
  template: 'bubble',
  output: 'lovelace/main.yaml',
  dashboard_name: 'Home',
  dashboard_path: 'home-main',
  dashboard_title: 'Home',
  dashboard_icon: 'mdi:home',
}

export default config
```

#### Example 3: Area Light Customization

Control which lights appear in each area's dashboard view:

```javascript
// dashboards/shared.js
const config = {
  schemaVersion: 1,
  language: 'en',
  pinned_areas: ['living_room', 'bedroom'],
  excluded_areas: [],
  default_scene_suffix: 'standard',

  areas: {
    living_room: {
      // Hide outdoor projector (controlled separately)
      excluded_lights: ['light.lr_lt_outdoor_projector'],
      // Add switch that controls lights
      included_lights: ['switch.lr_soc_e'],
    },

    bedroom: {
      // Hide utility lights
      excluded_lights: [
        'light.mb_lt_wardrobe',
        'light.mb_lt_ceiling_hall',
      ],
      // Show bedside socket as light control
      included_lights: ['switch.mb_soc'],
    },
  },
}

export default config
```

#### Example 4: Cross-Area Scene Sharing

Show scenes from one area in another area's view:

```javascript
// dashboards/shared.js
const config = {
  schemaVersion: 1,
  language: 'en',
  pinned_areas: ['living_room', 'kitchen', 'bedroom'],
  excluded_areas: [],
  default_scene_suffix: 'standard',

  areas: {
    // Kitchen can activate living room scenes (open plan)
    kitchen: {
      included_scenes: [
        'scene.lr_movie_mode',
        'scene.lr_dinner_party',
      ],
    },

    // Bedroom shows a cozy living room scene
    bedroom: {
      included_scenes: ['scene.lr_twilight_zone'],
    },

    // Remove party scene from living room (show in kitchen instead)
    living_room: {
      excluded_scenes: ['scene.lr_dinner_party'],
    },
  },
}

export default config
```

#### Example 5: User Visibility Restrictions

Restrict sensitive areas to specific users:

```javascript
// users.js
export const ADMIN = ['abc123-admin-id']
export const PARENTS = ['abc123-parent1-id', 'def456-parent2-id']
export const KIDS = ['ghi789-kid1-id', 'jkl012-kid2-id']
export const ALL_FAMILY = [...PARENTS, ...KIDS]
```

```javascript
// dashboards/shared.js
import { PARENTS, ADMIN } from '../users.js'

const config = {
  schemaVersion: 1,
  language: 'en',
  pinned_areas: ['living_room', 'kitchen'],
  excluded_areas: [],
  default_scene_suffix: 'standard',

  areas: {
    // Parent bedroom: adults only
    bedroom: {
      visible_to_users: PARENTS,
    },

    // Office: adults only
    office: {
      visible_to_users: PARENTS,
    },

    // Network closet: admin only
    network_closet: {
      visible_to_users: ADMIN,
    },

    // Kids rooms visible to everyone (no restriction)
    kids_room: {},
  },
}

export default config
```

#### Example 6: Bubble-Views with Home and Presence Cards

```javascript
// dashboards/views.config.js
import globalConfig from './shared.js'

const config = {
  ...globalConfig,
  template: 'bubble-views',
  output: 'lovelace/views.yaml',
  dashboard_name: 'Home',
  dashboard_path: 'home-views',
  dashboard_title: 'Home (Views)',
  dashboard_icon: 'mdi:view-dashboard-variant',

  // Quick action buttons on the home view
  home_card: {
    sub_buttons: [
      // Gate control
      { entity: 'switch.gate', icon: 'mdi:gate' },
      // Security camera
      { entity: 'camera.front_door', icon: 'mdi:cctv' },
      // Alarm (requires hold to prevent accidental trigger)
      { entity: 'switch.alarm', name: 'Alarm', action: 'hold' },
      // Turn off all AC (destructive, requires hold)
      { entity: 'script.ac_off', icon: 'mdi:snowflake-off', action: 'hold' },
      // Heating toggle
      { entity: 'switch.heating', icon: 'mdi:radiator', action: 'hold' },
    ],
  },

  // Who's home indicator
  presence_card: {
    entity: 'binary_sensor.anyone_home',
    users: [
      { name: 'Dad', entity: 'binary_sensor.dad_home', icon: 'mdi:account' },
      { name: 'Mom', entity: 'binary_sensor.mom_home', icon: 'mdi:account-heart' },
      { name: 'Emma', entity: 'binary_sensor.emma_home', icon: 'mdi:human-female-girl' },
      { name: 'Jack', entity: 'binary_sensor.jack_home', icon: 'mdi:human-male-boy' },
    ],
  },
}

export default config
```

#### Example 7: Multiple Dashboards for Different Use Cases

```javascript
// dashboards/tablet.config.js - Wall-mounted tablet dashboard
import globalConfig from './shared.js'

const config = {
  ...globalConfig,
  template: 'bubble',
  output: 'lovelace/tablet.yaml',
  dashboard_name: 'Tablet',
  dashboard_path: 'tablet',
  dashboard_title: 'Tablet',
  dashboard_icon: 'mdi:tablet',

  // Tablet shows fewer areas (nearby rooms only)
  pinned_areas: ['living_room', 'kitchen', 'dining_room'],
  excluded_areas: [
    ...globalConfig.excluded_areas,
    'bedroom', 'office', 'garage',  // Hide private/distant areas
  ],
}

export default config
```

```javascript
// dashboards/mobile.config.js - Phone dashboard with all areas
import globalConfig from './shared.js'

const config = {
  ...globalConfig,
  template: 'bubble-views',
  output: 'lovelace/mobile.yaml',
  dashboard_name: 'Mobile',
  dashboard_path: 'mobile',
  dashboard_title: 'Home',
  dashboard_icon: 'mdi:cellphone',
  // Full access to all areas
}

export default config
```

---

## User Groups

**File:** `users.js`

Define user groups for visibility restrictions. User IDs are found in Home Assistant under Settings → People → [Person] → Advanced.

**Example:**

```javascript
// users.js
// Find user IDs: HA Settings → People → [Person] → Advanced → User ID

export const ADMIN = ['abc123-your-admin-user-id']

export const PARENTS = [
  'abc123-parent1-id',
  'def456-parent2-id',
]

export const KIDS = [
  'ghi789-kid1-id',
  'jkl012-kid2-id',
]

// Combine groups as needed
export const ALL_FAMILY = [...PARENTS, ...KIDS]
export const ADULTS = [...ADMIN, ...PARENTS]
```

**Usage in dashboard config:**

```javascript
import { PARENTS, ADMIN } from '../users.js'

areas: {
  bedroom: {
    visible_to_users: PARENTS,  // Only parents can see
  },
  server_room: {
    visible_to_users: ADMIN,    // Admin only
  },
  living_room: {
    // No restriction - everyone sees this area
  },
}
```

---

## Multi-Language Dashboards

Generate multiple language variants of a dashboard using the `languages` array:

| Option | Type | Description |
|--------|------|-------------|
| `languages` | `LanguageVariant[]` | Array of language variant configurations. |

Each variant can override any dashboard-level option:

| Property | Type | Description |
|----------|------|-------------|
| `lang` | `string` | Language code (matches `i18n/*.csv` columns). |
| `output` | `string` | Override output path for this variant. |
| `dashboard_path` | `string` | Override URL path for this variant. |
| `dashboard_title` | `string` | Override sidebar title for this variant. |
| `dashboard_icon` | `string` | Override sidebar icon for this variant. |

**Example: Bilingual Home Dashboard**

```javascript
// dashboards/main.config.js
import globalConfig from './shared.js'

const config = {
  ...globalConfig,
  template: 'bubble',

  // Each language gets its own dashboard
  languages: [
    {
      lang: 'en',
      output: 'lovelace/main-en.yaml',
      dashboard_path: 'home-en',
      dashboard_title: 'Home',
    },
    {
      lang: 'es',
      output: 'lovelace/main-es.yaml',
      dashboard_path: 'home-es',
      dashboard_title: 'Casa',
    },
    {
      lang: 'he',
      output: 'lovelace/main-he.yaml',
      dashboard_path: 'home-he',
      dashboard_title: 'בית',
    },
  ],
}

export default config
```

**CLI Usage:**

```bash
# Generate all language variants
hass-gen generate --lang all

# Generate specific language only
hass-gen generate --lang es

# Default: generates all variants defined in config
hass-gen generate
```

---

## Common Patterns

### Pattern: Open Plan Living

When rooms flow into each other, share scenes between them:

```javascript
areas: {
  living_room: {
    excluded_scenes: ['scene.lr_dinner'],  // Show in kitchen instead
  },
  kitchen: {
    included_scenes: ['scene.lr_dinner', 'scene.lr_movie_mode'],
  },
  dining_room: {
    included_scenes: ['scene.lr_dinner', 'scene.kt_cooking'],
  },
}
```

### Pattern: Smart Bulb Behind Switch

Wall switch powers a smart bulb - use syncedEntities for bidirectional sync:

```javascript
// generator.config.js
areas: {
  bedroom: {
    syncedEntities: {
      mb_standing_lamp: {
        name: 'Bedroom Standing Lamp',
        power: null,  // or 'switch.mb_soc' if switch cuts power
        entities: [
          { entity_id: 'switch.mb_soc', sync: true },
          { entity_id: 'light.mb_soc_bulb', sync: true, controls: 'dimmable' },
        ],
      },
    },
  },
}
```

This generates:
- Sync automation: toggling switch also toggles bulb (and vice versa)
- Dashboard shows fixture with bulb's brightness slider, tap toggles switch
- All entities excluded from light group (fixture shown instead)

### Pattern: Parental Controls

Hide adult areas from kids' devices:

```javascript
// users.js
export const PARENTS = ['parent1-id', 'parent2-id']
export const KIDS = ['kid1-id', 'kid2-id']
```

```javascript
// dashboards/shared.js
import { PARENTS } from '../users.js'

areas: {
  bedroom: { visible_to_users: PARENTS },
  office: { visible_to_users: PARENTS },
  wine_cellar: { visible_to_users: PARENTS },
  // Kids rooms: no restriction (visible to all)
}
```

### Pattern: Utility Area Exclusion

Hide system/infrastructure areas from the dashboard:

```javascript
// dashboards/shared.js
const config = {
  excluded_areas: [
    'home_assistant',   // HA system entities
    'network_closet',   // Infrastructure
    'attic',            // Rarely accessed
    'garage',           // Separate access needed
  ],
}
```

### Pattern: Seasonal/Outdoor Lights

Globally exclude outdoor lights, but include them where needed:

```javascript
// generator.config.js
const config = {
  excluded_labels: ['outdoor', 'holiday_lights'],

  areas: {
    front_yard: {
      included_labels: ['outdoor'],  // Patio needs outdoor lights
    },
    backyard: {
      included_labels: ['outdoor', 'holiday_lights'],  // All outdoor lights
    },
  },
}
```

---

## Quick Reference

### Generator Config (`generator.config.js`)

```javascript
const config = {
  schemaVersion: 1,
  default_vacancy_duration: '00:09:00',
  excluded_labels: ['outdoor'],
  areas: {
    area_id: {
      vacancy_timer_duration: '00:05:00',
      include_in_group: ['switch.example'],
      exclude_from_group: ['light.example'],
      excluded_labels: [],
      included_labels: ['outdoor'],
      syncedEntities: {
        fixture_id: {
          name: 'Fixture Name',
          icon: 'mdi:wall-sconce-round',  // optional
          power: null,  // or 'light.power_relay'
          entities: [
            { entity_id: 'switch.actuator', sync: true },
            { entity_id: 'light.bulb', sync: true, controls: 'dimmable' },
          ],
        },
      },
    },
  },
}
```

### Dashboard Config (`dashboards/*.config.js`)

```javascript
const config = {
  schemaVersion: 1,
  template: 'bubble',
  output: 'lovelace/main.yaml',
  dashboard_name: 'Home',
  dashboard_path: 'home-main',
  dashboard_title: 'Home',
  dashboard_icon: 'mdi:view-dashboard',
  show_in_sidebar: true,
  language: 'en',
  pinned_areas: ['living_room', 'kitchen'],
  excluded_areas: ['home_assistant'],
  default_scene_suffix: 'standard',
  areas: {
    area_id: {
      excluded_lights: ['light.example'],
      included_lights: ['switch.example'],
      included_scenes: ['scene.other_area_scene'],
      excluded_scenes: ['scene.local_scene'],
      visible_to_users: ['user-id-1', 'user-id-2'],
    },
  },
}
```
