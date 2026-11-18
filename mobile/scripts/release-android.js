// Android release build: bumps android.versionCode (+1) and expo.version
// (patch, = versionName, shared with iOS), then builds the signed .aab for a
// manual Play Console upload. Commit app.json yourself afterwards.
//
//   npm run release:android                     1.0.9 (5) -> 1.0.10 (6)
//   npm run release:android -- --keep-version   1.0.9 (5) -> 1.0.9 (6)
//
// --keep-version: ship the version iOS just released. Build fails -> app.json
// is restored, so a retry doesn't skip numbers.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'app.json');
const original = fs.readFileSync(file, 'utf8');
const json = JSON.parse(original);

if (!process.argv.includes('--keep-version')) {
  const [a, b, c] = json.expo.version.split('.').map(Number);
  json.expo.version = `${a}.${b}.${c + 1}`;
}
json.expo.android.versionCode += 1;
const label = `${json.expo.version} (${json.expo.android.versionCode})`;
fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
console.log(`\nAndroid ${label}\n`);

try {
  // prebuild rewrites versionCode/versionName in android/app/build.gradle from app.json
  execSync('npm run build:aab', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
} catch {
  fs.writeFileSync(file, original);
  console.error('\nBuild falló: app.json restaurado.');
  process.exit(1);
}
console.log(`\nListo ${label}: android/app/build/outputs/bundle/release/app-release.aab`);
