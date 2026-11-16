import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
export const networkDisclosure = {
  version: 'network-sharing-v1',
  text: 'Share this authorized network’s passive IPv4 interface/gateway/neighbor observations (addresses and hardware identifiers) and supported router health/WAN counters with workspace network viewers. Neighbors and MACs are uncertain observations, not verified ownership or proof of connectivity. No active probing, packet content, per-client traffic or device enforcement is provided. Router credentials are encrypted on the server and delivered only over the paired collector connection; use a dedicated read-only router account and verified TLS. Samples/events expire after thirty days through scheduled maintenance; bounded inventory remains until erasure. Local consent, network assignment and enabled module are separately required. Stop sharing or erase records at any time; deletion while collection remains enabled can rediscover an endpoint.',
};
export const adapterProfiles = [
  {
    id: 'openwrt-ubus-v1',
    version: '1.0.0',
    family: 'OpenWrt rpcd/uhttpd ubus JSON-RPC v2',
    authentication: 'ubus-session-verified-https',
    hardwareStatus: 'unverified',
    features: [
      'wan_interface_health',
      'wan_counters',
      'optional_board_metadata',
    ],
    unavailable: [
      'per_client_bandwidth',
      'internet_probe',
      'device_enforcement',
    ],
    limitations:
      'Fixture-verified read-only protocol candidate; actual model, firmware, TLS and ACL behavior require authorized hardware tests.',
  },
];
export function privateIPv4(value: string): boolean {
  if (isIP(value) !== 4) return false;
  const [a, b] = value.split('.').map(Number);
  return (
    a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  );
}
function number(ip: string): number {
  return ip.split('.').reduce((n, p) => (n * 256 + Number(p)) >>> 0, 0);
}
export function prefix(value: string): { ip: string; bits: number } {
  const [ip, raw, ...extra] = value.split('/');
  const bits = Number(raw);
  if (
    extra.length ||
    !privateIPv4(ip) ||
    !/^\d{1,2}$/.test(raw ?? '') ||
    bits < 8 ||
    bits > 30
  )
    throw new BadRequestException(
      'Choose an RFC1918 IPv4 prefix from /8 through /30.',
    );
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  const first = (number(ip) & mask) >>> 0,
    last = (first + (2 ** (32 - bits) - 1)) >>> 0;
  const format = (n: number) =>
    [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join('.');
  if (!privateIPv4(format(first)) || !privateIPv4(format(last)))
    throw new BadRequestException('Prefix must remain inside RFC1918 space.');
  return { ip, bits };
}
export function contains(cidrs: string[], ip: string): boolean {
  if (!privateIPv4(ip)) return false;
  return cidrs.some((cidr) => {
    const p = prefix(cidr),
      mask = (0xffffffff << (32 - p.bits)) >>> 0;
    return (number(ip) & mask) === (number(p.ip) & mask);
  });
}
export function routerURL(raw: string, cidrs: string[]): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new BadRequestException('Choose a private HTTPS router URL.');
  }
  if (
    u.protocol !== 'https:' ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== '/ubus' ||
    !contains(cidrs, u.hostname)
  )
    throw new BadRequestException(
      'Router URL must be an explicit in-scope private IPv4 HTTPS /ubus endpoint without credentials/query/fragment.',
    );
  return u.toString();
}
function key(): Buffer {
  const value = process.env.ROUTER_CREDENTIAL_ENCRYPTION_KEY ?? '';
  if (
    !/^[A-Za-z0-9+/]{43}=$/.test(value) ||
    Buffer.from(value, 'base64').length !== 32
  )
    throw new ServiceUnavailableException(
      'Router credential encryption is not configured.',
    );
  return Buffer.from(value, 'base64');
}
export function encryptRouter(
  id: string,
  value: { username: string; password: string },
): string {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(`netsentry-router/v1/${id}`));
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}
export function decryptRouter(
  id: string,
  value: string,
): { username: string; password: string } {
  try {
    const raw = Buffer.from(value, 'base64'),
      cipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    cipher.setAAD(Buffer.from(`netsentry-router/v1/${id}`));
    cipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([cipher.update(raw.subarray(28)), cipher.final()]).toString(
        'utf8',
      ),
    );
  } catch {
    throw new ServiceUnavailableException(
      'Router credentials could not be opened; configure them again with the current key.',
    );
  }
}
export const maximumCounter = 18446744073709551615n;
export function counter(value: string | null): bigint | null {
  if (value === null) return null;
  if (!/^(0|[1-9]\d{0,19})$/.test(value) || BigInt(value) > maximumCounter)
    throw new BadRequestException(
      'Router counter is outside the unsigned 64-bit range.',
    );
  return BigInt(value);
}
