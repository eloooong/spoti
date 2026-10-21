const crypto = require("node:crypto");

function cookieKey(secret) {
  if (!secret) throw new Error("STATE_SECRET is required for serverless sessions");
  return crypto.createHash("sha256").update(secret).digest();
}

// AES-GCM protects both confidentiality and integrity. Purpose-bound associated
// data prevents an OAuth-state cookie from being used as a session cookie.
function sealCookie(value, secret, purpose, ttlMs) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", cookieKey(secret), iv);
  cipher.setAAD(Buffer.from(`SpotiStats:${purpose}`));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({ value, expiresAt: Date.now() + ttlMs })), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function openCookie(encoded, secret, purpose) {
  if (typeof encoded !== "string" || !secret) return null;
  try {
    const bytes = Buffer.from(encoded, "base64url");
    if (bytes.length <= 28) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", cookieKey(secret), bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(`SpotiStats:${purpose}`));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const payload = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
    if (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) return null;
    return payload.value;
  } catch {
    return null;
  }
}

module.exports = { sealCookie, openCookie };
