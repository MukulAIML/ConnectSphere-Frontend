/**
 * SockJS still references the Node-style `global` object in browser builds.
 * Webpack 5/Angular no longer auto-polyfill it, so we alias it explicitly.
 */
const globalRef = globalThis as typeof globalThis & { global?: typeof globalThis };
if (typeof globalRef.global === 'undefined') {
  globalRef.global = globalRef;
}
