/**
 * ALFRED Key Management
 */

export interface KeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

export async function loadKeys(): Promise<KeyPair> {
  // TODO: [Phase 3] Load Ed25519 keys from env paths
  // - Read JWT_PRIVATE_KEY_PATH and JWT_PUBLIC_KEY_PATH
  // - Import as CryptoKey objects
  // - Cache in memory
  throw new Error("Not implemented");
}

export async function generateKeys(): Promise<KeyPair> {
  // TODO: [Phase 3] Generate new Ed25519 key pair for development
  // - Use Web Crypto API or Node crypto
  // - Save to files
  throw new Error("Not implemented");
}
