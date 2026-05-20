/**
 * E2E stub for `file-type` (v22 is ESM-only and not consumable by the ts-jest
 * CommonJS pipeline). Only the media-processing service imports it and the
 * returns happy-path e2e never touches uploads. Returns null to indicate
 * "unknown" so any caller would treat the file as untyped (and fail closed
 * in the real service via its mime allowlist).
 */
async function fileTypeFromBuffer() {
  return null;
}

async function fileTypeFromBlob() {
  return null;
}

async function fileTypeFromStream() {
  return null;
}

async function fileTypeFromFile() {
  return null;
}

module.exports = {
  fileTypeFromBuffer,
  fileTypeFromBlob,
  fileTypeFromStream,
  fileTypeFromFile,
};
