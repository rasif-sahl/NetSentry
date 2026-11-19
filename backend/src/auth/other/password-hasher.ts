import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCallback);

@Injectable()
export class PasswordHasher {
  async hash(password: string) {
    const salt = randomBytes(16).toString('hex');
    const result = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt:${salt}:${result.toString('hex')}`;
  }

  async verify(password: string, stored: string) {
    const [algorithm, salt, encoded] = stored.split(':');
    if (algorithm !== 'scrypt' || !salt || !encoded) return false;
    const expected = Buffer.from(encoded, 'hex');
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }
}
