#!/bin/bash

set -e

echo "🚀 Starting deployment..."

# Check git status
echo "📊 Checking git status..."
git status

# Add all changes
echo "➕ Adding changes..."
git add -A

# Commit with timestamp
echo "💾 Committing..."
git commit -m "deploy: $(date +'%Y-%m-%d %H:%M:%S')" || echo "No changes to commit"

# Push to GitHub
echo "⬆️ Pushing to GitHub..."
git push

echo "✅ Pushed successfully! GitHub Actions will deploy to VPS automatically."
echo "⏳ Waiting 10 seconds for deployment to start..."
sleep 10

# Test website
echo "🔍 Testing website..."
if curl -s -I https://xlilian.art | head -1 | grep "200 OK"; then
  echo "✅ Homepage is working!"
else
  echo "⚠️ Homepage might not be ready yet, check later"
fi

echo ""
echo "🎉 Deployment completed! Visit https://xlilian.art to see changes."
