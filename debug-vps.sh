#!/bin/bash

# Debug script for VPS deployment
# Checks website status and common issues

DOMAIN="https://xlilian.art"
echo "🔍 VPS Website Debug Tool"
echo "========================="
echo ""

# Test homepage
echo "1. Testing homepage: $DOMAIN/"
status=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN"/)
if [ "$status" = "200" ]; then
  echo "   ✅ Status $status - OK"
else
  echo "   ❌ Status $status - ERROR"
fi
echo ""

# Test posts list
echo "2. Testing posts list: $DOMAIN/posts"
status=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN"/posts)
if [ "$status" = "200" ]; then
  echo "   ✅ Status $status - OK"
else
  echo "   ❌ Status $status - ERROR"
fi
echo ""

# Test a sample post
echo "3. Testing sample post: $DOMAIN/posts/520_"
status=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN"/posts/520_)
if [ "$status" = "200" ]; then
  echo "   ✅ Status $status - OK"
else
  echo "   ❌ Status $status - ERROR"
fi
echo ""

# Check if we can SSH to VPS
echo "4. Checking VPS SSH connection (47.77.237.222)..."
if ssh -o ConnectTimeout=5 -q david@47.77.237.222 exit; then
  echo "   ✅ SSH connection OK"
  echo ""
  echo "5. Checking web root on VPS..."
  ssh david@47.77.237.222 "
    if [ -d /var/www/html ]; then
      echo '   ✅ /var/www/html exists'
      count=$(ls -1 /var/www/html/*.html 2>/dev/null | wc -l)
      if [ "$count" -gt 0 ]; then
        echo "   ✅ Found $count HTML files"
      else
        echo '   ❌ No HTML files found'
      fi
      if [ -d /var/www/html/images ]; then
        img_count=$(ls -1 /var/www/html/images/ | wc -l)
        echo "   ✅ images/ directory exists with $img_count files"
      else
        echo '   ❌ images/ directory missing'
      fi
    else
      echo '   ❌ /var/www/html does not exist'
    fi
    echo ""
    echo "6. Checking nginx status..."
    sudo systemctl is-active --quiet nginx && echo '   ✅ nginx is running' || echo '   ❌ nginx is not running'
  "
else
  echo "   ❌ SSH connection failed"
  echo "   (Need SSH key configured on this machine)"
fi
echo ""

# Check GitHub Actions runner status on VPS
echo "7. Checking GitHub Actions runner status..."
if ssh david@47.77.237.222 "sudo systemctl is-active --quiet github-runner"; then
  echo "   ✅ github-runner service is running"
else
  echo "   ❌ github-runner service is not running"
  echo "   To start: ssh david@47.77.237.222 'sudo systemctl start github-runner'"
fi
echo ""

echo "📋 Summary:"
echo "- If all tests pass: ✅ Everything is working"
echo "- If SSH fails: Add your local SSH key to VPS ~/.ssh/authorized_keys"
echo "- If 404: Check if deployment completed on GitHub Actions"
echo "- If images not found: Check that /var/www/html/images exists"
