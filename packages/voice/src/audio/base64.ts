const chunkSize = 0x80_00;

export function arrayBufferToBase64(buf: ArrayBuffer): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buf).toString("base64");
  }

  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const length = Math.min(chunkSize, bytes.length - offset);
    let slice = "";
    for (let i = 0; i < length; i++) {
      const value = bytes[offset + i] ?? 0;
      slice += String.fromCharCode(value);
    }
    binary += slice;
  }

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  throw new Error("arrayBufferToBase64: no encoder available");
}

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(b64, "base64");
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }

  if (typeof atob === "function") {
    const binary = atob(b64);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  throw new Error("base64ToArrayBuffer: no decoder available");
}
