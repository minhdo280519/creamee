/**
 * lib/crypto.ts — Mã hoá AES-256-GCM cho API key của LLM provider.
 * Key lưu trong DB phải được mã hoá; KHÔNG bao giờ lưu plaintext.
 *
 * ENCRYPTION_KEY: chuỗi hex 64 ký tự (32 byte). Sinh bằng:
 *   openssl rand -hex 32
 */

import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY phải là chuỗi hex 64 ký tự (32 byte)');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Mã hoá plaintext → chuỗi base64 "iv:tag:ciphertext".
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Giải mã chuỗi từ encrypt() → plaintext.
 */
export function decrypt(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) throw new Error('Dữ liệu mã hoá không hợp lệ');
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64!, 'base64');
  const tag = Buffer.from(tagB64!, 'base64');
  const data = Buffer.from(dataB64!, 'base64');

  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

/** Che API key khi hiển thị: "sk-ant-...A1b2" */
export function maskKey(key: string): string {
  if (key.length <= 8) return '••••';
  return key.slice(0, 6) + '••••' + key.slice(-4);
}
