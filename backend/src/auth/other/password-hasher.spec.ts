import { PasswordHasher } from './password-hasher';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('hashes and verifies a password without storing the original value', async () => {
    const password = 'A-strong-password-123';
    const hash = await hasher.hash(password);
    expect(hash).not.toContain(password);
    await expect(hasher.verify(password, hash)).resolves.toBe(true);
    await expect(hasher.verify('incorrect-password', hash)).resolves.toBe(
      false,
    );
  });
});
