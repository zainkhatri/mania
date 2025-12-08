#!/bin/bash

echo "🧹 Clearing Metro bundler cache..."
rm -rf node_modules/.cache
rm -rf .expo
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-*

echo "✅ Cache cleared!"
echo ""
echo "📱 Now restart your Expo server with:"
echo "   npx expo start --clear"
