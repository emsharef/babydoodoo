#!/usr/bin/env bash
set -euo pipefail

echo "🔎 Checking for stray supabaseAdmin imports..."
if grep -R --line-number "supabaseAdmin" app lib 2>/dev/null; then
  echo "❌ Found references to supabaseAdmin. These should be removed. The project uses server-side clients built from the user's Bearer token instead."
  exit 1
else
  echo "✅ No supabaseAdmin references detected."
fi

echo "🔎 Checking environment variables (from /api/health)..."
echo "   Start the dev server and visit: http://localhost:3000/api/health"
