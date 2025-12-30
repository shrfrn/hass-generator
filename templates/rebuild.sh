#!/bin/bash
# =============================================================================
# rebuild.sh - Runs on DEV machine (your Mac/laptop)
# =============================================================================
# Full rebuild and deploy:
# 1. Fetches fresh data from Home Assistant (inventory)
# 2. Regenerates YAML packages and dashboards
# 3. Commits the changes
# 4. Ships to prod
#
# Usage: ./rebuild.sh [-m "commit message"]
# =============================================================================

# Parse arguments
COMMIT_MSG="Regenerate packages and dashboards"

while getopts "m:" opt; do
    case $opt in
        m) COMMIT_MSG="$OPTARG" ;;
        *) echo "Usage: $0 [-m \"commit message\"]"; exit 1 ;;
    esac
done

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "📦 Fetching inventory from Home Assistant..."
npx hass-gen inventory

echo ""
echo "⚙️  Generating YAML packages and dashboards..."
npx hass-gen generate

echo ""
echo "📝 Committing generated files..."
git add -A
git commit -m "$COMMIT_MSG" || echo "   (no changes to commit)"

echo ""
echo "🚀 Shipping to prod..."
"$SCRIPT_DIR/ship.sh"

