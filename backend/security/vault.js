const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits - GCM standard
const TAG_LENGTH = 16; // 128 bits auth tag

// Derive master key from ENCRYPTION_KEY env var
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  throw new Error("ENCRYPTION_KEY must be exactly 32 characters");
}

// Derive a 256-bit key using scrypt
const MASTER_KEY = crypto.scryptSync(ENCRYPTION_KEY, "salt", KEY_LENGTH);

/**
 * Encrypt an API key with AES-256-GCM.
 * Output format: v1:<iv_base64>:<auth_tag_base64>:<ciphertext_base64>
 * @param {string} plainTextApiKey
 * @returns {string}
 */
function encryptKey(plainTextApiKey) {
  if (!plainTextApiKey || typeof plainTextApiKey !== "string") {
    throw new Error("Invalid API key: must be a non-empty string");
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv, {
    authTagLength: TAG_LENGTH,
  });

  let encrypted = cipher.update(plainTextApiKey, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  const tag = cipher.getAuthTag();

  // Format: iv:tag:ciphertext (all hex encoded)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function splitEncryptedKey(encryptedApiKey) {
  if (!encryptedApiKey || typeof encryptedApiKey !== "string") {
    throw new Error("Invalid encrypted key: must be a non-empty string");
  }

  const parts = encryptedApiKey.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted key format");
  }

  const [iv, authTag, ciphertext] = parts;
  return { iv, authTag, ciphertext };
}

function encryptKeyParts(plainTextApiKey) {
  const combined = encryptKey(plainTextApiKey);
  const { iv, authTag, ciphertext } = splitEncryptedKey(combined);
  return { encryptedKey: combined, iv, authTag, ciphertext };
}

/**
 * Decrypt an API key using AES-256-GCM
 * @param {string} encryptedApiKey - Encrypted key in format: iv:tag:ciphertext
 * @returns {string} Decrypted plaintext API key
 *
 * CRITICAL: Decrypted key lives in memory <50ms. Never log, never return to client.
 */
function decryptKey(encryptedApiKey) {
  if (!encryptedApiKey || typeof encryptedApiKey !== "string") {
    throw new Error("Invalid encrypted key: must be a non-empty string");
  }

  const parts = encryptedApiKey.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted key format");
  }

  const [ivHex, tagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString("utf8");
}

function decryptKeyParts(ciphertext, ivHex, authTagHex) {
  const combined = `${ivHex}:${authTagHex}:${ciphertext}`;
  return decryptKey(combined);
}

module.exports = {
  encryptKey,
  encryptKeyParts,
  splitEncryptedKey,
  decryptKey,
  decryptKeyParts,
};
