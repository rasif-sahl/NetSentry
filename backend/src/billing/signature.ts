import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
export function verifyBillingSignature(
  raw: Buffer,
  stamp: string,
  signature: string,
  secret: string,
  now = Date.now(),
) {
  if (
    raw.length > 65536 ||
    secret.length < 32 ||
    !/^\d{10}$/.test(stamp) ||
    Math.abs(now / 1000 - Number(stamp)) > 300 ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    throw new UnauthorizedException('Billing event authentication failed.');
  const expected = createHmac('sha256', secret)
    .update(stamp + '.')
    .update(raw)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex')))
    throw new UnauthorizedException('Billing event authentication failed.');
}
export const payloadHash = (raw: Buffer) =>
  createHash('sha256').update(raw).digest('hex');
