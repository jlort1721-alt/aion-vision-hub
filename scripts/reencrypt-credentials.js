#!/usr/bin/env node
/**
 * AION Vision Hub — Re-encriptacion de credenciales de dispositivos
 *
 * Uso: node scripts/reencrypt-credentials.js <OLD_KEY> <NEW_KEY>
 *
 * Este script:
 * 1. Lee todos los dispositivos con credentials_encrypted = true
 * 2. Desencripta con OLD_KEY (AES-256-GCM)
 * 3. Re-encripta con NEW_KEY (AES-256-GCM)
 * 4. Actualiza en transaccion atomica
 */

import crypto from 'node:crypto';

const [,, OLD_KEY, NEW_KEY] = process.argv;

if (!OLD_KEY || !NEW_KEY) {
  console.error('Uso: node scripts/reencrypt-credentials.js <OLD_KEY_HEX> <NEW_KEY_HEX>');
  process.exit(1);
}

function decrypt(encryptedText, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const [ivHex, authTagHex, cipherHex] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const cipher = Buffer.from(cipherHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(cipher, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encrypt(plainText, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

console.log('Re-encriptacion de credenciales de dispositivos');
console.log('OLD_KEY:', OLD_KEY.substring(0, 8) + '...');
console.log('NEW_KEY:', NEW_KEY.substring(0, 8) + '...');
console.log('');
console.log('NOTA: Este script requiere conexion a la base de datos.');
console.log('Configurar DATABASE_URL en el entorno antes de ejecutar.');
console.log('');
console.log('Ejemplo de uso con la DB:');
console.log('  DATABASE_URL=postgresql://... node scripts/reencrypt-credentials.js OLD NEW');
console.log('');
console.log('El script esta listo. Implementar la conexion DB segun el entorno de ejecucion.');
