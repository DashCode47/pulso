// mixpanel-react-native runs in JavaScript mode (lib/analytics.ts): no native
// module, so keep it out of autolinking -- no pod to compile (Xcode 26.3, see
// patches/) and nothing to rebuild when the SDK updates.
module.exports = {
  dependencies: {
    'mixpanel-react-native': { platforms: { ios: null, android: null } },
  },
};
