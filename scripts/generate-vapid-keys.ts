#!/usr/bin/env npx tsx
/**
 * Generate VAPID key pair for Web Push notifications.
 *
 * Usage:
 *   npx tsx scripts/generate-vapid-keys.ts
 *
 * The output can be copied directly into your .env file.
 */

import { generateKeyPairSync, createECDH } from 'crypto';

function generateVapidKeys(): { publicKey: string; privateKey: string } {
  // VAPID uses the P-256 curve (prime256v1)
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();

  // Public key: uncompressed point in URL-safe base64
  const publicKey = ecdh.getPublicKey().toString('base64url');
  // Private key: raw 32-byte scalar in URL-safe base64
  const privateKey = ecdh.getPrivateKey().toString('base64url');

  return { publicKey, privateKey };
}

// ── Main ──────────────────────────────────────────────────────────

const { publicKey, privateKey } = generateVapidKeys();

console.log('');
console.log('VAPID keys generated successfully.');
console.log('Add the following lines to your .env file:');
console.log('');
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@aionvisionhub.com`);
console.log('');
console.log('Public key (share with frontend for push subscription):');
console.log(publicKey);
console.log('');
