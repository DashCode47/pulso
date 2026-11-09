# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# iOS release (Xcode Cloud)

- Push to `master` touching `mobile/**` → `.github/workflows/bump-version.yml` bumps the `app.json` patch version (1.0.2 → 1.0.3), commits `[skip ci]`, and pushes tag `vX.Y.Z`. Don't bump `expo.version` by hand. Run `git pull` after each push or the next push is rejected.
- Xcode Cloud workflow "Default" starts on tags with prefix `v` (not branch pushes) and archives `mobile/ios/Pulso.xcworkspace`, scheme `Pulso`.
- `mobile/ios` is gitignored except `ios/ci_scripts/ci_post_clone.sh`, which runs `npm ci` + `expo prebuild` + `pod install` on Xcode Cloud and sets `CFBundleVersion` to `CI_BUILD_NUMBER`.
- `EXPO_PUBLIC_*` vars live in Xcode Cloud workflow env vars (separate from EAS and `mobile/.env`). Adding a new one means adding it there too.
- `android.versionCode` is not auto-bumped; bump it manually per Play upload.
