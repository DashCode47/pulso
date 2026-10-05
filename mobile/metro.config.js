// Sentry's Expo config: adds debug IDs so release stack traces map back to source.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
