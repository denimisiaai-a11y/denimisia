// Pass-through stub. isomorphic-dompurify is ESM-only; ts-jest's default
// transformIgnorePatterns refuses to transform it. Tests don't exercise the
// sanitizer for real, so identity-return is sufficient.
const DOMPurify = {
  sanitize: (input: string): string => input,
  isValidAttribute: (): boolean => true,
  addHook: (): void => undefined,
  removeHook: (): void => undefined,
  removeAllHooks: (): void => undefined,
  setConfig: (): void => undefined,
  clearConfig: (): void => undefined,
};

export default DOMPurify;
export { DOMPurify };
