#!/bin/bash
# =============================================================================
# deploy.sh - Runs on PROD (Home Assistant server)
# =============================================================================
# Called by ship.sh via SSH. Pulls changes, validates, merges to main, restarts.
# This script should be symlinked from /root/deploy.sh
#
# Setup on Pi:
#   ln -sf /root/config/scripts/deploy.sh /root/deploy.sh
# =============================================================================

BRANCH=$1
REPO_DIR=/root/config
EXIT_CODE=0

cd "$REPO_DIR"

# Commit any local UI changes (scenes, automations, scripts created via HA UI)
if [ -n "$(git status --porcelain)" ]; then
    echo "Committing local UI changes..."
    git add -A
    git commit -m "Auto-commit: UI changes from Home Assistant"
    git push origin main
fi

git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "[STAGE:CHECK]"
echo "Running config check..."
if ha core check; then
    echo "[STAGE:CHECK_PASS]"
    echo "Check passed! Merging to main..."
    git checkout main
    git merge "$BRANCH" --no-ff -m "Deploy: $BRANCH"
    git push origin main

    echo "[STAGE:RESTART]"
    echo "Restarting Home Assistant..."
    ha core restart
    echo "[STAGE:RESTART_DONE]"

    echo "Deployment complete"
else
    echo "[STAGE:CHECK_FAIL]"
    echo "Config check failed!"
    EXIT_CODE=1
    git checkout main
fi

exit $EXIT_CODE
