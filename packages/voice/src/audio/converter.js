/**
 * Audio format conversion utilities
 */
function encodeBase64(binary) {
  if (typeof btoa === "function") {
    return btoa(binary);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(binary, "binary").toString("base64");
  }
  throw new Error("base64_encode_unavailable");
}
function decodeBase64(base64) {
  if (typeof atob === "function") {
    return atob(base64);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(base64, "base64").toString("binary");
  }
  throw new Error("base64_decode_unavailable");
}
/**
 * Convert base64 string to ArrayBuffer
 */
export function base64ToBuffer(base64) {
  // Handle data URI format (data:mime;base64,...)
  const parts = base64.split(",");
  const base64Data = (parts.length > 1 ? parts[1] : base64) ?? "";
  const binaryString = decodeBase64(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
/**
 * Convert ArrayBuffer to base64 string
 */
export function bufferToBase64(buffer, mimeType) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = encodeBase64(binary);
  if (mimeType) {
    return `data:${mimeType};base64,${base64}`;
  }
  return base64;
}
/**
 * Convert Buffer to base64 string (Node.js/Bun)
 */
export function bufferToBase64Node(buffer, mimeType) {
  const base64 = buffer.toString("base64");
  if (mimeType) {
    return `data:${mimeType};base64,${base64}`;
  }
  return base64;
}
/**
 * Convert base64 string to Buffer (Node.js/Bun)
 */
export function base64ToBufferNode(base64) {
  const parts = base64.split(",");
  const base64Data = (parts.length > 1 ? parts[1] : base64) ?? "";
  return Buffer.from(base64Data, "base64");
}
/**
 * Convert ArrayBuffer (browser) to Base64 string (no data URI prefix)
 */
export function arrayBufferToBase64(buffer) {
  return bufferToBase64(buffer);
}
/**
 * Convert Base64 string (with or without data URI) to ArrayBuffer
 */
export function base64ToArrayBuffer(base64) {
  return base64ToBuffer(base64);
}
//# sourceMappingURL=converter.js.map
