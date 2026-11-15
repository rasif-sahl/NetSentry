import { encryptMail, decryptMail } from './mail-crypto';
const key = Buffer.alloc(32, 7).toString('base64');
describe('encrypted account mail', () => {
  it('binds ciphertext to the outbox identity and rejects tampering', () => {
    const encrypted = encryptMail({ token: 'secret' }, key, 'mail-1');
    expect(encrypted).not.toContain('secret');
    expect(decryptMail(encrypted, key, 'mail-1')).toEqual({ token: 'secret' });
    expect(() => decryptMail(encrypted, key, 'mail-2')).toThrow();
    const parts = encrypted.split('.');
    parts[2] = Buffer.alloc(16).toString('base64url');
    expect(() => decryptMail(parts.join('.'), key, 'mail-1')).toThrow();
  });
});
