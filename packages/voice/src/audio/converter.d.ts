/**
 * Audio format conversion utilities
 */
/**
 * Convert base64 string to ArrayBuffer
 */
export declare function base64ToBuffer(base64: string): ArrayBuffer;
/**
 * Convert ArrayBuffer to base64 string
 */
export declare function bufferToBase64(
  buffer: ArrayBuffer,
  mimeType?: string
): string;
/**
 * Convert Buffer to base64 string (Node.js/Bun)
 */
export declare function bufferToBase64Node(
  buffer: Buffer,
  mimeType?: string
): string;
/**
 * Convert base64 string to Buffer (Node.js/Bun)
 */
export declare function base64ToBufferNode(base64: string): Buffer;
/**
 * Convert ArrayBuffer (browser) to Base64 string (no data URI prefix)
 */
export declare function arrayBufferToBase64(buffer: ArrayBuffer): string;
/**
 * Convert Base64 string (with or without data URI) to ArrayBuffer
 */
export declare function base64ToArrayBuffer(base64: string): ArrayBuffer;
