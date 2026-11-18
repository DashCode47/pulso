// app.json "orientation": "portrait" sets screenOrientation="portrait" on the
// activity, and Play then treats android.hardware.screen.portrait as required,
// hiding the app from tablets, Chromebooks and XR. Declaring it optional keeps
// the portrait lock on phones without limiting where the app can install.
const { withAndroidManifest } = require('expo/config-plugins');

const FEATURE = 'android.hardware.screen.portrait';

module.exports = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const features = (manifest['uses-feature'] ??= []);
    if (!features.some((f) => f.$['android:name'] === FEATURE)) {
      features.push({ $: { 'android:name': FEATURE, 'android:required': 'false' } });
    }
    return cfg;
  });
