#!/bin/bash
# =============================================================================
# rebuild.sh - Runs on DEV machine (your Mac/laptop)
# =============================================================================
# Full rebuild and deploy:
# 1. Fetches fresh data from Home Assistant (inventory)
# 2. Regenerates YAML packages and dashboards
# 3. Ships to prod
# =============================================================================

# Guard: Prevent running on prod
if [ -f /etc/hassio.json ]; then
    echo "❌ This script should be run from your dev machine, not prod"
    exit 1
fi

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "📦 Fetching inventory from Home Assistant..."
npx hass-gen inventory

echo ""
echo "⚙️  Generating YAML packages and dashboards..."
npx hass-gen generate

echo ""
echo "🚀 Shipping to prod..."
"$SCRIPT_DIR/ship.sh"

