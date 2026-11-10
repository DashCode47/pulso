#!/bin/sh
# Xcode Cloud: mobile/ios is gitignored (Expo prebuild), so generate it here.
# Point the Xcode Cloud workflow at mobile/ios/Pulso.xcworkspace.
# EXPO_PUBLIC_* vars must be set as Xcode Cloud workflow env vars (EAS env isn't visible here).
set -e
brew install node cocoapods
cd "$CI_PRIMARY_REPOSITORY_PATH/mobile"
# Xcode Cloud env vars aren't reliably visible to the Metro bundling build phase,
# but Expo always reads .env, so persist them here. Missing Supabase config = crash on launch, so fail the build.
: "${EXPO_PUBLIC_SUPABASE_URL:?set in Xcode Cloud workflow env}" "${EXPO_PUBLIC_SUPABASE_KEY:?set in Xcode Cloud workflow env}"
env | grep '^EXPO_PUBLIC_' > .env
npm ci
npx expo prebuild --platform ios --no-install
cd ios && pod install
# Unique build number per Xcode Cloud run; the marketing version comes from app.json.
plutil -replace CFBundleVersion -string "$CI_BUILD_NUMBER" Pulso/Info.plist
