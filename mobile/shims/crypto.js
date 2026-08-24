// Metro (React Native's bundler) has no Node "crypto" module and can't
// tree-shake @insforge/sdk's `await import('crypto')` fallback, which it
// only takes when globalThis.crypto.subtle is missing (see
// node_modules/@insforge/sdk/dist/index.mjs getWebCrypto()). This shim just
// satisfies that import so Metro can bundle; RN's own globalThis.crypto is
// what actually gets used at runtime.
module.exports = { webcrypto: globalThis.crypto };
