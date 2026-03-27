#!/bin/bash
set -e

# ==============================================================================
# VPS Rollback Script
# Rollback to a previous deployment backup
# ==============================================================================

# Configuration
VPS_HOST="root@47.77.237.222"
REMOTE_DIR="/var/www/html"
BACKUP_DIR="/var/www/backups"
SITE_URL="https://xlilian.art"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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

# Check argument
if [ $# -ne 1 ]; then
    echo "Usage: $0 <backup-name>"
    echo
    echo "Available backups on VPS:"
    ssh "$VPS_HOST" "ls -la $BACKUP_DIR/ | awk '{if(NR>2) print \$9}'"
    exit 1
fi

BACKUP_NAME="$1"
FULL_BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

# Verify backup exists
info "Verifying backup exists..."
if ! ssh "$VPS_HOST" "[ -d '$FULL_BACKUP_PATH' ]"; then
    error "Backup $FULL_BACKUP_PATH does not exist on VPS"
fi
info "Backup found: $FULL_BACKUP_PATH"

# List backup content
echo "Backup content:"
ssh "$VPS_HOST" "ls -lh '$FULL_BACKUP_PATH'"
echo

# Confirm
warn "This will overwrite $REMOTE_DIR with backup $BACKUP_NAME"
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    info "Rollback cancelled"
    exit 0
fi

# Create backup of current deployment before rollback
CURRENT_BACKUP="$BACKUP_DIR/pre-rollback-$(date +%Y%m%d_%H%M%S)"
info "Creating backup of current deployment before rollback..."
ssh "$VPS_HOST" "mkdir -p '$CURRENT_BACKUP' && cp -a $REMOTE_DIR/* '$CURRENT_BACKUP/'"
info "Current state backed up to $CURRENT_BACKUP"

# Do rollback
info "Rolling back to $BACKUP_NAME..."
ssh "$VPS_HOST" "rm -rf $REMOTE_DIR/* && cp -a '$FULL_BACKUP_PATH'/* $REMOTE_DIR/"
info "Rollback completed"

# Fix permissions
info "Fixing file permissions..."
ssh "$VPS_HOST" "chown -R david:david $REMOTE_DIR && chmod -R 755 $REMOTE_DIR"
info "Permissions fixed"

# Health check
info "Waiting 5 seconds..."
sleep 5
info "Running health check..."

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL")

if [ "$HTTP_STATUS" = "200" ]; then
    echo
    info "✅ Rollback successful! Health check passed (HTTP $HTTP_STATUS)"
else
    warn "Health check returned HTTP $HTTP_STATUS"
    warn "Please check the site manually."
fi

echo
echo "======================================================================"
info "Rollback completed!"
echo "🔙 Rollback to: $FULL_BACKUP_PATH"
echo "📦 Pre-rollback backup: $CURRENT_BACKUP"
echo "🌐 Website: $SITE_URL"
echo "======================================================================"
echo
