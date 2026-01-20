#!/bin/bash
# =============================================================================
# deploy.sh - Runs on PROD (Home Assistant server)
# =============================================================================
# Called by ship.sh via SSH. Pulls changes, validates, merges to main, restarts.
# This script should be symlinked from /root/deploy.sh
#
# Setup on Pi:
#   ln -sf /root/config/scripts/deploy.sh /root/deploy.sh
#
# Note: HA UI-managed files (automations.yaml, scenes.yaml, scripts.yaml) are
# gitignored to avoid divergence. They're backed up by HA's built-in backups.
# =============================================================================

BRANCH=$1
REPO_DIR=/root/config
EXIT_CODE=0

cd "$REPO_DIR"

git fetch origin

# Ensure main is current
git checkout main
git pull origin main

# Checkout branch and reset to match origin (avoids divergence from previous rebases)
git checkout "$BRANCH" || {
	echo "ERROR: Could not checkout branch $BRANCH"
	exit 1
}
git reset --hard origin/"$BRANCH" || {
	echo "ERROR: Could not reset branch to origin/$BRANCH"
	exit 1
}

# Only rebase if main has moved forward since branch was created
BRANCH_BASE=$(git merge-base "$BRANCH" main)
MAIN_HEAD=$(git rev-parse main)

if [ "$BRANCH_BASE" != "$MAIN_HEAD" ]; then
	echo "Main has diverged, rebasing branch onto latest main..."
	git rebase main || {
		echo "Rebase failed - branch has conflicts with main"
		git rebase --abort
		EXIT_CODE=1
		exit $EXIT_CODE
	}
fi

echo "[STAGE:CHECK]"
echo "Running config check..."
if ha core check; then
	echo "[STAGE:CHECK_PASS]"
	echo "Check passed! Merging to main..."
	git checkout main

	git merge "$BRANCH" --ff-only || {
		echo "ERROR: Fast-forward merge failed (unexpected)"
		exit 1
	}
	git push origin main || {
		echo "ERROR: Failed to push to origin. Deployment completed locally but not synced."
		exit 1
	}

	echo "[STAGE:RESTART]"
	echo "Restarting Home Assistant..."
	ha core restart
	echo "[STAGE:RESTART_DONE]"

	# Cleanup: reset local branch to match remote (avoids rebase divergence)
	git branch -f "$BRANCH" origin/"$BRANCH" 2>/dev/null || true

	echo "Deployment complete"
else
	echo "[STAGE:CHECK_FAIL]"
	echo "Config check failed!"
	EXIT_CODE=1
	git checkout main
fi

exit $EXIT_CODE
