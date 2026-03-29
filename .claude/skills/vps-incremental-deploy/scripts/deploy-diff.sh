#!/bin/bash
set -e

# ==============================================================================
# VPS Git-Diff Based Deployment Script
# 基于 git diff 的智能增量部署
# ==============================================================================

# Configuration
VPS_HOST="root@101.132.32.3"
REMOTE_DIR="/var/www/html"
LOCAL_DIR="./dist"
BACKUP_DIR="/var/www/backups/$(date +%Y%m%d_%H%M%S)"
SITE_URL="https://xlilian.cn"
PM2_APP_NAME="painting-dairy"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}==> WARNING:${NC} $1"; }
error() { echo -e "${RED}==> ERROR:${NC} $1"; exit 1; }
step() { echo -e "${BLUE}==>${NC} $1"; }

# ==============================================================================
# Analyze git changes
# ==============================================================================

analyze_changes() {
    step "Analyzing git changes..."

    # Get list of changed files (staged + unstaged)
    CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null || git diff --name-only)
    STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || echo "")

    # Combine and deduplicate
    ALL_CHANGES=$(echo "$CHANGED_FILES $STAGED_FILES" | tr ' ' '\n' | sort -u)

    if [ -z "$ALL_CHANGES" ]; then
        info "No changes detected. Nothing to deploy."
        exit 0
    fi

    echo
    info "Changed files:"
    echo "$ALL_CHANGES" | while read -r file; do
        echo "  • $file"
    done
    echo

    # Categorize changes
    SRC_FILES=$(echo "$ALL_CHANGES" | grep -E '^src/' || true)
    CONFIG_FILES=$(echo "$ALL_CHANGES" | grep -E '^(package\.json|astro\.config|tsconfig|tailwind)' || true)
    STATIC_FILES=$(echo "$ALL_CHANGES" | grep -E '^public/' || true)
    CONTENT_FILES=$(echo "$ALL_CHANGES" | grep -E '^src/content/' || true)

    # Determine deployment strategy
    if [ -n "$SRC_FILES" ] || [ -n "$CONFIG_FILES" ]; then
        DEPLOY_MODE="full"
        info "Source code or config changes detected. Will perform FULL build & deploy."
    elif [ -n "$CONTENT_FILES" ]; then
        DEPLOY_MODE="content"
        info "Content changes detected. Will rebuild and deploy."
    elif [ -n "$STATIC_FILES" ]; then
        DEPLOY_MODE="static"
        info "Static file changes detected. Will sync only changed files."
    else
        DEPLOY_MODE="none"
        info "No deployable changes detected."
    fi
}

# ==============================================================================
# Deploy based on mode
# ==============================================================================

deploy_full() {
    step "Starting FULL deployment..."

    # Pre-flight checks
    info "Testing SSH connection..."
    if ! ssh -o ConnectTimeout=10 "$VPS_HOST" "echo 'SSH OK'" > /dev/null 2>&1; then
        error "Cannot connect to VPS"
    fi

    # Backup
    info "Creating backup..."
    ssh "$VPS_HOST" "mkdir -p $BACKUP_DIR && cp -a $REMOTE_DIR/* $BACKUP_DIR/ 2>/dev/null || true"

    # Build
    info "Installing dependencies (if needed)..."
    if [ "package.json" -nt "node_modules" ] 2>/dev/null; then
        npm install
    fi

    info "Building project..."
    npm run build

    if [ ! -d "$LOCAL_DIR" ]; then
        error "Build failed - no dist directory"
    fi

    # Sync
    info "Syncing to VPS..."
    rsync -avz --delete --progress "$LOCAL_DIR/" "$VPS_HOST:$REMOTE_DIR/"

    # Sync package.json and install prod deps
    info "Installing production dependencies on VPS..."
    rsync -av package.json package-lock.json "$VPS_HOST:$REMOTE_DIR/"
    ssh "$VPS_HOST" "cd $REMOTE_DIR && npm install --omit=dev"

    # Restart PM2
    info "Restarting PM2..."
    if ssh "$VPS_HOST" "pm2 status | grep -q $PM2_APP_NAME" 2>/dev/null; then
        ssh "$VPS_HOST" "pm2 restart $PM2_APP_NAME"
    else
        ssh "$VPS_HOST" "cd $REMOTE_DIR && PORT=3001 pm2 start server/entry.mjs --name $PM2_APP_NAME"
    fi

    # Fix permissions
    ssh "$VPS_HOST" "chown -R david:david $REMOTE_DIR && chmod -R 755 $REMOTE_DIR"

    # Health check
    info "Health check..."
    sleep 3
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL" || echo "000")
    if [ "$HTTP_STATUS" = "200" ]; then
        info "✅ Deployment successful! Site is healthy."
    else
        warn "Health check returned HTTP $HTTP_STATUS"
    fi

    echo
    echo "======================================================================"
    info "🎉 Deployment completed!"
    echo "📦 Backup: $BACKUP_DIR"
    echo "🌐 Website: $SITE_URL"
    echo "======================================================================"
}

deploy_static() {
    step "Deploying static files only..."

    # Get changed static files
    CHANGED_STATIC=$(git diff --name-only HEAD | grep '^public/' || true)

    if [ -z "$CHANGED_STATIC" ]; then
        info "No static file changes to deploy."
        return
    fi

    # Sync each changed file
    echo "$CHANGED_STATIC" | while read -r file; do
        if [ -f "$file" ]; then
            target_path="${file#public/}"
            info "Syncing: $file -> $target_path"
            rsync -avz "$file" "$VPS_HOST:$REMOTE_DIR/$target_path"
        fi
    done

    info "✅ Static files deployed."
}

deploy_content() {
    step "Deploying content changes..."
    # Content changes require rebuild
    deploy_full
}

# ==============================================================================
# Main
# ==============================================================================

main() {
    echo
    echo "╔══════════════════════════════════════════════════════════════════════╗"
    echo "║           VPS Git-Diff Based Deployment                            ║"
    echo "║           基于 Git 变更的智能增量部署                                   ║"
    echo "╚══════════════════════════════════════════════════════════════════════╝"
    echo

    # Check if in git repo
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        error "Not a git repository. Please run from project root."
    fi

    # Analyze changes
    analyze_changes

    # Confirm deployment
    if [ "$DEPLOY_MODE" != "none" ]; then
        echo
        read -p "Continue with deployment? [Y/n] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]] && [ ! -z "$REPLY" ]; then
            info "Deployment cancelled."
            exit 0
        fi
    fi

    # Execute deployment based on mode
    case "$DEPLOY_MODE" in
        full|content)
            deploy_full
            ;;
        static)
            deploy_static
            ;;
        none)
            info "Nothing to deploy."
            ;;
    esac
}

main "$@"
