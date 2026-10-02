// Signs local release builds with the upload keystore configured in
// ~/.gradle/gradle.properties (PULSO_UPLOAD_*), so `gradlew bundleRelease`
// keeps working after `expo prebuild` regenerates android/. Without those
// properties it falls back to the debug keystore (fine for test APKs).
// EAS cloud builds inject their own signing and ignore this.
const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = (config) =>
  withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes('PULSO_UPLOAD_STORE_FILE')) return cfg;

    gradle = gradle.replace(
      'signingConfigs {',
      `signingConfigs {
        release {
            if (project.hasProperty('PULSO_UPLOAD_STORE_FILE')) {
                storeFile file(PULSO_UPLOAD_STORE_FILE)
                storePassword PULSO_UPLOAD_STORE_PASSWORD
                keyAlias PULSO_UPLOAD_KEY_ALIAS
                keyPassword PULSO_UPLOAD_KEY_PASSWORD
            }
        }`
    );
    const [head, buildTypes] = gradle.split('buildTypes {');
    gradle =
      head +
      'buildTypes {' +
      buildTypes.replace(
        /(release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
        "$1signingConfig project.hasProperty('PULSO_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug"
      );

    // Fail loudly rather than silently ship a debug-signed release if the
    // Expo template changes shape.
    if (!gradle.includes('signingConfigs.release :')) {
      throw new Error('withReleaseSigning: could not patch android/app/build.gradle');
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });
