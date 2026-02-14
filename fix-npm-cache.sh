#!/bin/bash
# Fix npm cache permissions issue
# Run this script with: sudo ./fix-npm-cache.sh

echo "Fixing npm cache permissions..."
chown -R $(logname) ~/.npm
echo "Done! npm should work normally now."
echo ""
echo "Verify by running:"
echo "  cd frontend && rm -rf node_modules && npm install && npm run build"
