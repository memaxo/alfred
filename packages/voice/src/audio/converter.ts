/**
 * Audio format conversion utilities
 */

/**
 * Convert base64 string to ArrayBuffer
 */
export function base64ToBuffer(base64: string): ArrayBuffer {
  // Handle data URI format (data:mime;base64,...)
  const base64Data = base64.includes(",") ? base64.split(",")[1]! : base64;
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert ArrayBuffer to base64 string
 */
export function bufferToBase64(buffer: ArrayBuffer, mimeType?: string): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary);
  
  if (mimeType) {
    return `data:${mimeType};base64,${base64}`;
  }
  return base64;
}

/**
 * Convert Buffer to base64 string (Node.js/Bun)
 */
export function bufferToBase64Node(buffer: Buffer, mimeType?: string): string {
  const base64 = buffer.toString("base64");
  if (mimeType) {
    return `data:${mimeType};base64,${base64}`;
  }
  return base64;
}

/**
 * Convert base64 string to Buffer (Node.js/Bun)
 */
export function base64ToBufferNode(base64: string): Buffer {
  const base64Data = base64.includes(",") ? base64.split(",")[1]! : base64;
  return Buffer.from(base64Data, "base64");
}
