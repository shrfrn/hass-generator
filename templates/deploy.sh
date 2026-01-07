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
HAD_UI_CHANGES=""
if [ -n "$(git status --porcelain)" ]; then
    echo "Committing local UI changes..."
    git add -A
    git commit -m "Auto-commit: UI changes from Home Assistant"
    git push origin main || {
        echo "ERROR: Failed to push UI changes to origin"
        exit 1
    }
    HAD_UI_CHANGES="yes"
fi

git fetch origin

# Check for divergence between local main and origin/main
LOCAL_MAIN=$(git rev-parse main)
REMOTE_MAIN=$(git rev-parse origin/main)
MERGE_BASE=$(git merge-base main origin/main)

if [ "$MERGE_BASE" != "$REMOTE_MAIN" ] && [ "$MERGE_BASE" != "$LOCAL_MAIN" ]; then
    echo "ERROR: Local main has diverged from origin/main"
    echo "Both have commits the other doesn't. Manual resolution required."
    echo ""
    echo "Commits on local main not in origin:"
    git log --oneline origin/main..main
    echo ""
    echo "Commits on origin not in local main:"
    git log --oneline main..origin/main
    exit 1
fi

# Ensure main is current (only pull if we didn't just push it)
git checkout main
if [ -z "$HAD_UI_CHANGES" ]; then
    git pull origin main
fi

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
