import { createHash } from 'node:crypto';
export const metrics = {
  mobile_data_bytes: {
    unit: 'bytes',
    scope: 'network_usage',
    capability: 'network.mobile_data',
  },
  wifi_data_bytes: {
    unit: 'bytes',
    scope: 'network_usage',
    capability: 'network.wifi_data',
  },
  screen_time_seconds: {
    unit: 'seconds',
    scope: 'app_usage',
    capability: 'usage.screen_time',
  },
  application_foreground_seconds: {
    unit: 'seconds',
    scope: 'app_usage',
    capability: 'usage.application_foreground',
  },
} as const;
export type Metric = keyof typeof metrics;
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export const fingerprint = (value: unknown) =>
  createHash('sha256').update(canonical(value)).digest('hex');
export const micro = (value: string) => {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
};
export const decimal = (value: bigint) =>
  `${value / 1000000n}.${(value % 1000000n).toString().padStart(6, '0')}`;
export function allocate(total: bigint, durations: number[]): bigint[] {
  const full = BigInt(durations.reduce((a, b) => a + b, 0));
  let remaining = total;
  return durations.map((duration, index) => {
    const portion =
      index === durations.length - 1
        ? remaining
        : (total * BigInt(duration)) / full;
    remaining -= portion;
    return portion;
  });
}
