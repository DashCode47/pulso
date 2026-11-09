# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# iOS release (Xcode Cloud)

- Release = `gh workflow run bump-version.yml` (or GitHub Actions tab → Bump version → Run workflow). It bumps the `app.json` patch version on `master` (1.0.2 → 1.0.3), commits `[skip ci]`, and pushes tag `vX.Y.Z`. Plain pushes don't release. Don't bump `expo.version` by hand. Run `git pull` after a release.
- Xcode Cloud workflow "Default" starts on tags with prefix `v` (not branch pushes) and archives `mobile/ios/Pulso.xcworkspace`, scheme `Pulso`.
- `mobile/ios` is gitignored except `ios/ci_scripts/ci_post_clone.sh`, which runs `npm ci` + `expo prebuild` + `pod install` on Xcode Cloud and sets `CFBundleVersion` to `CI_BUILD_NUMBER`.
- `EXPO_PUBLIC_*` vars live in Xcode Cloud workflow env vars (separate from EAS and `mobile/.env`). Adding a new one means adding it there too.
- `android.versionCode` is not auto-bumped; bump it manually per Play upload.

# Cached data

- After any mutation, update every cached copy of the changed data, not just the screen you're on. Check: the auth store (`features/auth/store.ts`, e.g. `user.name` on Home/Profile), React Query caches (grep `queryKey` for queries that embed the field: `setQueryData` or `invalidateQueries` with the narrowest key), and analytics identity (`lib/analytics.ts`). List the places you updated in your reply.
