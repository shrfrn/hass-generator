# Home Assistant Generator Workflow

## Two Repositories

This system consists of **two separate repositories**:

### 1. `hass-generator` (The Tool)

A reusable CLI tool that generates Home Assistant configuration files. Install it once, use it across multiple HA installations.

- **GitHub**: `github.com/shrfrn/hass-generator`
- **What it does**: Provides `hass-gen` commands (inventory, generate, init)
- **You typically don't clone this** — it's installed as an npm dependency

### 2. `hass-config` (Your Installation)

Your specific Home Assistant configuration. Contains your areas, entities, scenes, and generated files.

- **GitHub**: `github.com/shrfrn/hass-config` (or your own repo)
- **What it does**: Stores configuration for one Home Assistant instance
- **This is what you clone** on both dev machine and prod server

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          hass-generator (tool)                              │
│                     installed via npm / package.json                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ provides hass-gen commands
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        hass-config (your config)                            │
│                    cloned to dev machine AND prod server                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Overview

The generation workflow:
1. **Inventory**: Fetch entity/area/scene data from Home Assistant
2. **Generate**: Create YAML packages and Lovelace dashboards from templates
3. **Ship**: Deploy to production Home Assistant server

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DEV MACHINE (Mac)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   inventory  │───▶│   generate   │───▶│     ship     │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│         │                   │                   │                          │
│         ▼                   ▼                   ▼                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │  inventory/  │    │  packages/   │    │  git push    │                  │
│  │  hass-data   │    │  lovelace/   │    │  + SSH       │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│                                                 │                          │
└─────────────────────────────────────────────────│──────────────────────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROD (Home Assistant Server)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │  git pull    │───▶│  ha check    │───▶│  ha restart  │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Commands

### NPX Commands (hass-generator tool)

| Command | Description |
|---------|-------------|
| `npx hass-gen inventory` | Fetch entities, areas, scenes, labels from HA → saves to `inventory/` |
| `npx hass-gen generate` | Read inventory + configs → generate `packages/` and `lovelace/` |
| `npx hass-gen generate --yaml-only` | Generate only YAML packages |
| `npx hass-gen generate --dashboard-only` | Generate only dashboards |
| `npx hass-gen init [path]` | Initialize a new HA config project with starter files |

### Shell Scripts (in hass-config/scripts/)

| Script | Runs On | Description |
|--------|---------|-------------|
| `scripts/rebuild.sh` | Dev | Full pipeline: inventory → generate → ship |
| `scripts/ship.sh` | Dev | Auto-commit if changes, push, trigger prod deploy |
| `scripts/ship.sh -m "msg"` | Dev | Commit with custom message, push, deploy |
| `scripts/ship.sh --force` | Dev | Deploy already-pushed commits (skip commit/push) |
| `scripts/deploy.sh` | Prod | Pull from GitHub, merge, restart HA |

---

## Typical Workflows

### After changing Home Assistant (entities, areas, scenes)

```bash
./scripts/rebuild.sh
```

This fetches fresh data, regenerates everything, and deploys.

### After changing config files only

```bash
npx hass-gen generate
./scripts/ship.sh                    # Auto-commits as "WIP: <timestamp>"
./scripts/ship.sh -m "Fix lights"    # Or with custom message
```

No need to re-fetch inventory if HA entities haven't changed.

### Quick iteration (dashboard tweaks)

```bash
npx hass-gen generate --dashboard-only
./scripts/ship.sh                    # Auto-commits and deploys
```

### Re-deploy already-pushed commits

If commits were pushed but not deployed (e.g., prod had issues), use `--force`:

```bash
./scripts/ship.sh --force
```

This skips the commit/push steps and triggers prod deploy directly.

---

## File Structure (hass-config)

```
hass-config/
├── configuration.yaml      # Main HA config (manual)
├── automations.yaml        # HA automations (UI-managed)
├── scripts.yaml            # HA scripts (UI-managed)
├── scenes.yaml             # HA scenes (UI-managed)
│
├── generator.config.js     # YAML package generation config
├── dashboards/             # Dashboard configs
│   └── main.config.js      # Main dashboard config
├── users.js                # User ID constants
├── package.json            # Pins hass-generator version
│
├── inventory/              # Generated by `hass-gen inventory`
│   ├── hass-data.json      # Raw HA data
│   ├── entities.js         # Entity reference by area
│   └── types/              # TypeScript definitions
│
├── packages/               # Generated by `hass-gen generate`
│   ├── areas/              # Per-area YAML packages
│   └── labels/             # Per-label YAML packages
│
├── lovelace/               # Generated dashboards
│   └── main.yaml           # Main Bubble Card dashboard
│
└── scripts/                # Deployment scripts
    ├── rebuild.sh          # Dev: inventory + generate + ship
    ├── ship.sh             # Dev: push + trigger prod deploy
    └── deploy.sh           # Prod: pull + merge + restart
```

---

## Setup

### Dev Machine (Mac)

1. **Clone your hass-config repo** (not hass-generator):
   ```bash
   git clone git@github.com:youruser/hass-config.git
   cd hass-config
   ```

2. **Install dependencies** (this installs hass-generator as a dev dependency):
   ```bash
   npm install
   ```

3. **Create `.env`** with your HA connection:
   ```
   HASS_HOST=homeassistant.local
   HASS_TOKEN=your_long_lived_token
   ```

4. **Run initial inventory**:
   ```bash
   npx hass-gen inventory
   ```

### Prod (Home Assistant Server)

1. **Clone your hass-config repo** to the HA config directory:
   ```bash
   cd /root
   git clone git@github.com:youruser/hass-config.git config
   ```

2. **Symlink the deploy script** so ship.sh can find it:
   ```bash
   ln -sf /root/config/scripts/deploy.sh /root/deploy.sh
   ```

3. **Ensure SSH access** from your dev machine to `root@homeassistant.local`

---

## Branching Strategy (hass-config)

The branching strategy applies to your **hass-config** repo (not hass-generator):

- **Feature branches** (e.g., `add-new-room`): Development work
- **main**: Production-ready, deployed to HA

The `ship.sh` script:
1. Pushes your feature branch to GitHub
2. Triggers prod to pull and test the branch
3. If config check passes, merges to main and restarts HA

---

## Starting a New Installation

To create a fresh hass-config for a new Home Assistant instance:

```bash
# Create and initialize
npx hass-gen init my-home-config
cd my-home-config

# Set up git
git init
git remote add origin git@github.com:youruser/my-home-config.git

# Configure and generate
cp .env.example .env
# Edit .env with your HA credentials
npm install
npx hass-gen inventory
npx hass-gen generate
```
