#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "🏗️  Building WorshipCenter for mobile (Capacitor static export)..."

# ── Exclude API routes ──────────────────────────────────────
# Next.js "output: export" cannot build server-side API route handlers.
# The mobile app calls the deployed web server's API via absolute URLs
# (see src/lib/api-base.ts → apiUrl()), so the static bundle doesn't need them.
API_DIR="src/app/api"
API_BACKUP=".mobile-backup-api"

if [ -d "$API_DIR" ]; then
  rm -rf "$API_BACKUP"
  mv "$API_DIR" "$API_BACKUP"
  echo "📦 Temporarily excluded $API_DIR for static export"
fi

# ── Exclude middleware ──────────────────────────────────────
# Middleware doesn't run in static export and can cause build warnings.
MW_FILE="src/middleware.ts"
MW_BACKUP="src/middleware._mobile_excluded.ts"

if [ -f "$MW_FILE" ]; then
  mv "$MW_FILE" "$MW_BACKUP"
  echo "📦 Temporarily excluded $MW_FILE"
fi

# ── Build ───────────────────────────────────────────────────
# Restore everything even if the build fails
cleanup() {
  if [ -d "$API_BACKUP" ]; then
    rm -rf "$API_DIR"
    mv "$API_BACKUP" "$API_DIR"
    echo "♻️  Restored $API_DIR"
  fi
  if [ -f "$MW_BACKUP" ]; then
    mv "$MW_BACKUP" "$MW_FILE"
    echo "♻️  Restored $MW_FILE"
  fi
}
trap cleanup EXIT

rm -rf out
rm -rf .next 2>/dev/null || true
NEXT_PUBLIC_STATIC_EXPORT=true STATIC_EXPORT=true npx next build 2>&1

echo "✅ Static export complete — syncing Capacitor..."
# Use cap copy (fast, no native rebuild) then try cap sync for plugin updates.
# cap sync can be slow / fail on pod install issues; copy is the critical path.
npx cap copy
npx cap sync || echo "⚠️  cap sync had issues (pod/gradle) — run 'npx cap sync' manually if plugins changed"

echo "🚀 Mobile build complete!"
echo "   iOS:       npx cap open ios"
echo "   Android:   npx cap open android"
