/**
 * E2E stub for isomorphic-dompurify.
 *
 * The real package pulls in jsdom 28 → html-encoding-sniffer → whatwg-encoding
 * → @exodus/bytes which ship ESM-only `exports`, and the ts-jest e2e harness
 * cannot load them. CMS sanitization is only exercised by unit tests / live
 * runs — for e2e bootstrap we just need the import to resolve.
 *
 * The exported `sanitize` is the identity function — e2e specs that target
 * CMS endpoints should add their own DOMPurify mock if they need real
 * sanitization semantics. The returns/refunds happy-path test does not.
 */
const DOMPurify = {
  sanitize: (input) => (typeof input === 'string' ? input : String(input ?? '')),
  isValidAttribute: () => true,
  isSupported: true,
  addHook: () => {},
  removeHook: () => {},
  removeHooks: () => {},
  removeAllHooks: () => {},
  setConfig: () => {},
  clearConfig: () => {},
};

module.exports = DOMPurify;
module.exports.default = DOMPurify;
