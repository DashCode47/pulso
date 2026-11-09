#!/bin/sh
# Xcode Cloud: mobile/ios is gitignored (Expo prebuild), so generate it here.
# Point the Xcode Cloud workflow at mobile/ios/Pulso.xcworkspace.
# EXPO_PUBLIC_* vars must be set as Xcode Cloud workflow env vars (EAS env isn't visible here).
set -e
brew install node cocoapods
cd "$CI_PRIMARY_REPOSITORY_PATH/mobile"
npm ci
npx expo prebuild --platform ios --no-install
cd ios && pod install
# Unique build number per Xcode Cloud run; the marketing version comes from app.json.
plutil -replace CFBundleVersion -string "$CI_BUILD_NUMBER" Pulso/Info.plist
