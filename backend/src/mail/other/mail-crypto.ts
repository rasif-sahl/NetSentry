import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export function encryptMail(payload: unknown, key: string, id: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'base64'), iv);
  cipher.setAAD(Buffer.from(id));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return [
    1,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptMail(value: string, key: string, id: string): unknown {
  const [version, iv, tag, ciphertext, extra] = value.split('.');
  if (version !== '1' || !iv || !tag || !ciphertext || extra)
    throw new Error('Invalid encrypted mail envelope.');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'base64'),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAAD(Buffer.from(id));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8'),
  ) as unknown;
}
