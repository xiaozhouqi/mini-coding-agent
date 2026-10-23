import { safeStorage } from 'electron';

// TEACHING: Secret-at-rest. Electron's `safeStorage` encrypts with the OS
// keychain (Windows DPAPI / macOS Keychain / Linux libsecret). We store only
// ciphertext (base64) in SQLite and decrypt in memory when the agent starts.
//
// Responsibility: wrap safeStorage with a hard guarantee — never persist a
// secret in plaintext, and fail loudly if the keychain is unavailable.

/** Whether the OS keychain can encrypt/decrypt (always true on Windows/macOS). */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

/** Encrypt a secret; returns base64 ciphertext for storage. Throws if unavailable. */
export function encryptSecret(plaintext: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS keychain unavailable — refusing to store the API key in plaintext');
  }
  return safeStorage.encryptString(plaintext).toString('base64');
}

/** Decrypt base64 ciphertext back to the plaintext secret. Empty input -> empty string. */
export function decryptSecret(ciphertextBase64: string): string {
  if (!ciphertextBase64) return '';
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS keychain unavailable — cannot decrypt the API key');
  }
  return safeStorage.decryptString(Buffer.from(ciphertextBase64, 'base64'));
}
