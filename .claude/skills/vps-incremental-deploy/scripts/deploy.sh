#!/bin/bash
set -e

# ==============================================================================
# VPS Incremental Deployment Script
# For painting-dairy (xlilian.cn)
# ==============================================================================

# Configuration - edit these if needed
# 支持通过环境变量覆盖默认配置
VPS_HOST="${VPS_HOST:-root@101.132.32.3}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/html}"
LOCAL_DIR="${LOCAL_DIR:-./dist}"
BACKUP_DIR="${BACKUP_DIR:-/var/www/backups/$(date +%Y%m%d_%H%M%S)}"
SITE_URL="${SITE_URL:-https://xlilian.cn}"
PM2_APP_NAME="${PM2_APP_NAME:-painting-dairy}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() {
    echo -e "${GREEN}==>${NC} $1"
}

warn() {
    echo -e "${YELLOW}==> WARNING:${NC} $1"
}

error() {
    echo -e "${RED}==> ERROR:${NC} $1"
    exit 1
}

info "Using VPS_HOST: $VPS_HOST"

warn() {
    echo -e "${YELLOW}==> WARNING:${NC} $1"
}

error() {
    echo -e "${RED}==> ERROR:${NC} $1"
    exit 1
}

warn() {
    echo -e "${YELLOW}==> WARNING:${NC} $1"
}

error() {
    echo -e "${RED}==> ERROR:${NC} $1"
    exit 1
}

# ==============================================================================
# Step 1: Pre-flight checks
# ==============================================================================

info "Starting pre-flight checks..."

# Check SSH connectivity
info "Testing SSH connection to $VPS_HOST..."
if ! ssh -o ConnectTimeout=10 "$VPS_HOST" "echo 'SSH connection OK'"; then
    error "Cannot connect to $VPS_HOST via SSH. Please check your SSH configuration."
fi

# Check remote directory exists
info "Checking remote directory $REMOTE_DIR..."
if ! ssh "$VPS_HOST" "[ -d $REMOTE_DIR ]"; then
    error "Remote directory $REMOTE_DIR does not exist on VPS."
fi

# Check disk space on remote
info "Checking remote disk space..."
DISK_FREE=$(ssh "$VPS_HOST" "df -P $REMOTE_DIR | awk 'NR==2 {print \$4}'")
if [ "$DISK_FREE" -lt 100000 ]; then
    warn "Low disk space on VPS: only $((DISK_FREE / 1024))MB free"
else
    info "VPS disk space OK: $((DISK_FREE / 1024))MB free"
fi

# Check Nginx configuration
info "Checking Nginx configuration..."
if ! ssh "$VPS_HOST" "which nginx > /dev/null"; then
    error "Nginx not found on VPS"
fi
if ! ssh "$VPS_HOST" "nginx -t"; then
    error "Nginx configuration is invalid"
else
    info "Nginx configuration OK"
fi

# Check local project
info "Checking local project..."
if [ ! -f "package.json" ]; then
    error "package.json not found. Are you in the project root?"
fi

info "Pre-flight checks completed successfully!"

# ==============================================================================
# Step 2: Local dependency install if needed
# ==============================================================================

echo
info "Checking for dependency changes..."

if [ -f "node_modules" ] && [ -f "package-lock.json" ]; then
    # Check if package.json is newer than node_modules
    if [ "package.json" -nt "node_modules" ]; then
        info "package.json changed, running npm install..."
        npm install
    else
        info "No dependency changes detected, skipping npm install"
    fi
else
    info "node_modules not found, running full npm install..."
    npm install
fi

# ==============================================================================
# Step 3: Local build
# ==============================================================================

echo
info "Building project locally..."
npm run build

if [ ! -d "$LOCAL_DIR" ]; then
    error "Build failed: $LOCAL_DIR directory not found after build"
fi
info "Local build completed successfully!"

# ==============================================================================
# Step 4: Backup current deployment on remote
# ==============================================================================

echo
info "Creating backup of current deployment on VPS..."
ssh "$VPS_HOST" "mkdir -p $BACKUP_DIR && cp -a $REMOTE_DIR/* $BACKUP_DIR/ && echo 'Backup created at $BACKUP_DIR'"
info "Backup completed: $BACKUP_DIR"

# ==============================================================================
# Step 5: Rsync incremental sync
# ==============================================================================

echo
info "Starting incremental sync with rsync..."
info "Syncing $LOCAL_DIR -> $VPS_HOST:$REMOTE_DIR"

# Use rsync with:
# -a: archive mode (preserve permissions, etc)
# -v: verbose
# -z: compress during transfer
# --delete: delete files that don't exist locally
# --progress: show progress
rsync -avz --delete --progress "$LOCAL_DIR/" "$VPS_HOST:$REMOTE_DIR/"

echo
info "Rsync sync completed!"

# ==============================================================================
# Step 6: Sync package.json and install production dependencies on remote
# ==============================================================================
# For SSR deployment, node_modules must be installed on remote because:
# - Local build only outputs compiled Astro code
# - Runtime dependencies are still needed
# ==============================================================================

echo
info "Syncing package.json to remote..."
rsync -av package.json package-lock.json "$VPS_HOST:$REMOTE_DIR/"

echo
info "Installing production dependencies on remote..."
ssh "$VPS_HOST" "cd $REMOTE_DIR && npm install --omit=dev"
info "Remote dependencies installed!"

# ==============================================================================
# Step 7: Restart PM2 process
# ==============================================================================

echo
info "Restarting PM2 process: $PM2_APP_NAME..."
if ssh "$VPS_HOST" "pm2 status | grep -q $PM2_APP_NAME"; then
    ssh "$VPS_HOST" "pm2 restart $PM2_APP_NAME"
else
    info "PM2 process not found, starting it..."
    ssh "$VPS_HOST" "cd $REMOTE_DIR && PORT=3001 pm2 start server/entry.mjs --name $PM2_APP_NAME"
fi
info "PM2 process restarted!"

# ==============================================================================
# Step 8: Fix permissions on remote
# ==============================================================================

echo
info "Fixing file permissions on remote..."
ssh "$VPS_HOST" "chown -R david:david $REMOTE_DIR && chmod -R 755 $REMOTE_DIR"
info "Permissions fixed"

# ==============================================================================
# Step 9: Health check
# ==============================================================================

echo
info "Waiting 5 seconds for deployment to settle..."
sleep 5

echo
info "Running health check on $SITE_URL..."

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL")

if [ "$HTTP_STATUS" = "200" ]; then
    echo
    info "✅ Health check passed! Site returns $HTTP_STATUS OK"
else
    warn "Health check returned HTTP $HTTP_STATUS"
    warn "Site might still be warming up, please check manually later."
fi

# ==============================================================================
# Done!
# ==============================================================================

echo
echo "======================================================================"
info "🎉 Deployment completed successfully!"
echo
echo "📦 Backup: $BACKUP_DIR (on VPS)"
echo "🌐 Website: $SITE_URL"
echo "To rollback: ./scripts/rollback.sh $(basename $BACKUP_DIR)"
echo "======================================================================"
echo
