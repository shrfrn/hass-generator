#!/bin/bash
# =============================================================================
# ship.sh - Runs on DEV machine (your Mac/laptop)
# =============================================================================
# Pushes current branch to GitHub, then SSHs to prod to trigger deploy.
# Shows progress with spinner while waiting for config check and restart.
#
# Usage:
#   ./ship.sh              Auto-commit WIP if changes exist, then deploy
#   ./ship.sh -m "msg"     Commit with custom message, then deploy
#   ./ship.sh --force      Deploy already-pushed commits
# =============================================================================

# Guard: Prevent running on prod
if [ -f /etc/hassio.json ]; then
    echo "❌ This script should be run from your dev machine, not prod"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

PROD_HOST="root@homeassistant.local"
PROD_SCRIPT="/root/deploy.sh"

# Colors
WHITE='\033[1;37m'
RED='\033[1;31m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
CYAN='\033[1;36m'
DIM='\033[2m'
NC='\033[0m'

SPINNER='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'

# Parse arguments
FORCE=false
COMMIT_MSG=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE=true
            shift
            ;;
        -m)
            COMMIT_MSG="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

BRANCH=$(git branch --show-current)

if [ "$BRANCH" = "main" ]; then
    echo -e "${RED}Error: Switch to a feature branch first.${NC}"
    exit 1
fi

# Check for uncommitted changes
HAS_CHANGES=false
if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    HAS_CHANGES=true
fi

UNPUSHED=$(git log origin/$BRANCH..$BRANCH --oneline 2>/dev/null | wc -l | tr -d ' ')

# If uncommitted changes exist, auto-commit them
if [ "$HAS_CHANGES" = true ]; then
    if [ -z "$COMMIT_MSG" ]; then
        COMMIT_MSG="WIP: $(date '+%Y-%m-%d %H:%M')"
    fi
    
    echo ""
    echo -e "${WHITE}📝 Committing changes...${NC}"
    git add -A
    git commit -m "$COMMIT_MSG" 2>&1 | sed "s/^/   /"
    
    # Recalculate unpushed commits
    UNPUSHED=$(git log origin/$BRANCH..$BRANCH --oneline 2>/dev/null | wc -l | tr -d ' ')
fi

if [ "$UNPUSHED" -eq 0 ] && [ "$FORCE" = false ]; then
    echo -e "${YELLOW}No new commits to deploy on $BRANCH${NC}"
    echo -e "${DIM}Use --force to deploy already-pushed commits.${NC}"
    exit 0
fi

if [ "$UNPUSHED" -gt 0 ]; then
    echo ""
    echo -e "${WHITE}📤 Pushing $BRANCH to origin...${NC}"
    git push origin "$BRANCH" 2>&1 | sed "s/^/   /"
elif [ "$FORCE" = true ]; then
    echo ""
    echo -e "${WHITE}📤 Force deploy (no new commits to push)${NC}"
fi

echo ""
echo -e "${CYAN}🚀 Deploying to prod...${NC}"
echo ""

# Temp file for output
TEMP_OUT=$(mktemp)
TOTAL_START=$SECONDS

# Run SSH in background
ssh "$PROD_HOST" "$PROD_SCRIPT $BRANCH" > "$TEMP_OUT" 2>&1 &
SSH_PID=$!

# Spinner function
spin_until_stage() {
    local msg="$1"
    local stage_marker="$2"
    local start=$SECONDS
    local i=0
    
    while kill -0 $SSH_PID 2>/dev/null; do
        # Check if stage marker appeared
        if grep -q "$stage_marker" "$TEMP_OUT" 2>/dev/null; then
            local elapsed=$((SECONDS - start))
            printf "\r   ${GREEN}✓${NC} ${msg} ${DIM}(${elapsed}s)${NC}          \n"
            return 0
        fi
        
        # Check for failure
        if grep -q "\[STAGE:CHECK_FAIL\]" "$TEMP_OUT" 2>/dev/null; then
            local elapsed=$((SECONDS - start))
            printf "\r   ${RED}✗${NC} Config check failed ${DIM}(${elapsed}s)${NC}          \n"
            return 1
        fi
        
        local elapsed=$((SECONDS - start))
        printf "\r   ${YELLOW}${SPINNER:i++%10:1}${NC} ${msg}... ${DIM}${elapsed}s${NC}  "
        sleep 0.1
    done
    
    # SSH ended, check final state
    if grep -q "$stage_marker" "$TEMP_OUT" 2>/dev/null; then
        local elapsed=$((SECONDS - start))
        printf "\r   ${GREEN}✓${NC} ${msg} ${DIM}(${elapsed}s)${NC}          \n"
        return 0
    fi
    return 1
}

# Wait for config check
spin_until_stage "Config check" "\[STAGE:CHECK_PASS\]"
CHECK_RESULT=$?

if [ $CHECK_RESULT -eq 0 ]; then
    # Wait for restart
    spin_until_stage "Home Assistant restart" "\[STAGE:RESTART_DONE\]"
fi

# Wait for SSH to finish
wait $SSH_PID
EXIT_CODE=$?

TOTAL_TIME=$((SECONDS - TOTAL_START))

# Show prod output (filter out stage markers)
echo ""
echo -e "${DIM}── Prod log ──${NC}"
grep -v "^\[STAGE:" "$TEMP_OUT" | while IFS= read -r line; do
    echo -e "   ${DIM}│${NC} $line"
done
echo -e "${DIM}──────────────${NC}"
rm -f "$TEMP_OUT"

if [ "$EXIT_CODE" -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Deploy succeeded!${NC} ${DIM}(${TOTAL_TIME}s total)${NC}"
    
    echo -e "${WHITE}📥 Updating local main...${NC}"
    git fetch origin main:main 2>&1 | sed "s/^/   /"
    
    echo ""
    echo -e "${GREEN}🎉 Done - staying on $BRANCH (main updated)${NC}"
else
    echo ""
    echo -e "${RED}❌ Deploy failed${NC}"
    echo -e "${RED}   Fix the issues and try again.${NC}"
    exit 1
fi

