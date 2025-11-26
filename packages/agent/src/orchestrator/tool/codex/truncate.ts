import { Buffer } from "node:buffer";

export function truncateToBytes(text: string, maxBytes: number): string {
  if (!text || maxBytes <= 0) {
    return "";
  }

  const totalBytes = Buffer.byteLength(text);
  if (totalBytes <= maxBytes) {
    return text;
  }

  let consumedBytes = 0;
  let endIndex = 0;

  for (const char of text) {
    const charBytes = Buffer.byteLength(char);
    if (consumedBytes + charBytes > maxBytes) {
      break;
    }
    consumedBytes += charBytes;
    endIndex += char.length;
  }

  return text.slice(0, endIndex);
}
