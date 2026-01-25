/**
 * Credential Encryption
 *
 * Provides AES-256-GCM encryption for credentials when Bun.secrets is unavailable.
 * Uses machine-specific data to derive the encryption key.
 */

import { createHash, randomBytes } from "node:crypto";
import { hostname, userInfo } from "node:os";

// AES-256-GCM parameters
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Derive a machine-specific encryption key.
 *
 * Uses a combination of:
 * - Hostname
 * - Username
 * - User ID (Unix)
 *
 * This ensures credentials encrypted on one machine can't be decrypted elsewhere.
 */
function deriveMachineKey(salt: Uint8Array): Uint8Array<ArrayBuffer> {
  const user = userInfo();
  const machineId = [
    hostname(),
    user.username,
    String(user.uid ?? 0),
    "alfred-cli-v1", // Version tag for key derivation changes
  ].join(":");

  // PBKDF2-like key derivation using SHA-256
  const hash = createHash("sha256");
  hash.update(salt);
  hash.update(machineId);

  // Multiple rounds for key strengthening
  let derived = hash.digest();
  for (let i = 0; i < 10_000; i++) {
    const round = createHash("sha256");
    round.update(derived);
    round.update(salt);
    derived = round.digest();
  }

  // Create a new Uint8Array with explicit ArrayBuffer backing
  const keyBuffer = new ArrayBuffer(KEY_LENGTH);
  const keyView = new Uint8Array(keyBuffer);
  keyView.set(derived.slice(0, KEY_LENGTH));
  return keyView;
}

/**
 * Encrypted data format:
 * - 16 bytes: Salt
 * - 12 bytes: IV
 * - 16 bytes: Auth tag
 * - Rest: Ciphertext
 */
interface EncryptedData {
  salt: string; // Base64
  iv: string; // Base64
  tag: string; // Base64
  data: string; // Base64
  version: 1;
}

/**
 * Encrypt credentials using AES-256-GCM.
 *
 * @param data - JSON-serializable data to encrypt
 * @returns Encrypted data as a JSON string
 */
export async function encryptCredentials(data: unknown): Promise<string> {
  const plaintext = JSON.stringify(data);
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveMachineKey(salt);

  // Use Web Crypto API for encryption
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      tagLength: AUTH_TAG_LENGTH * 8,
    },
    cryptoKey,
    new TextEncoder().encode(plaintext)
  );

  // The last 16 bytes of ciphertext are the auth tag
  const ciphertextWithTag = new Uint8Array(ciphertext);
  const tag = ciphertextWithTag.slice(-AUTH_TAG_LENGTH);
  const encryptedData = ciphertextWithTag.slice(0, -AUTH_TAG_LENGTH);

  const result: EncryptedData = {
    salt: Buffer.from(salt).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
    tag: Buffer.from(tag).toString("base64"),
    data: Buffer.from(encryptedData).toString("base64"),
    version: 1,
  };

  return JSON.stringify(result);
}

/**
 * Decrypt credentials using AES-256-GCM.
 *
 * @param encrypted - Encrypted data as JSON string
 * @returns Decrypted data
 * @throws If decryption fails (wrong machine, tampered data, etc.)
 */
export async function decryptCredentials<T = unknown>(
  encrypted: string
): Promise<T> {
  const { salt, iv, tag, data, version } = JSON.parse(
    encrypted
  ) as EncryptedData;

  if (version !== 1) {
    throw new Error("encryption_version_unsupported");
  }

  const saltBytes = Buffer.from(salt, "base64");
  const ivBytes = new Uint8Array(Buffer.from(iv, "base64"));
  const tagBytes = new Uint8Array(Buffer.from(tag, "base64"));
  const ciphertext = new Uint8Array(Buffer.from(data, "base64"));

  const key = deriveMachineKey(saltBytes);

  // Reconstruct ciphertext with tag for Web Crypto
  const ciphertextWithTag = new Uint8Array(ciphertext.length + tagBytes.length);
  ciphertextWithTag.set(ciphertext);
  ciphertextWithTag.set(tagBytes, ciphertext.length);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBytes,
        tagLength: AUTH_TAG_LENGTH * 8,
      },
      cryptoKey,
      ciphertextWithTag
    );

    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    throw new Error(
      "decryption_failed: Credentials may have been encrypted on a different machine"
    );
  }
}

/**
 * Check if a string contains encrypted data.
 */
export function isEncrypted(data: string): boolean {
  try {
    const parsed = JSON.parse(data);
    return (
      parsed &&
      typeof parsed === "object" &&
      "version" in parsed &&
      "salt" in parsed &&
      "iv" in parsed &&
      "tag" in parsed &&
      "data" in parsed
    );
  } catch {
    return false;
  }
}
