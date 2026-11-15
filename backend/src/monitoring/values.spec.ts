import { allocate, decimal, fingerprint, micro } from './values';
describe('exact usage values', () => {
  it('preserves totals when splitting across unequal DST days', () => {
    const parts = allocate(micro('9007199254740991.000000'), [
      23 * 3600000,
      24 * 3600000,
      25 * 3600000,
    ]);
    expect(parts.reduce((a, b) => a + b, 0n)).toBe(
      micro('9007199254740991.000000'),
    );
    expect(decimal(allocate(1n, [1, 1, 1])[2])).toBe('0.000001');
  });
  it('hashes object order consistently and preserves array order', () => {
    expect(fingerprint({ a: 1, b: 2 })).toBe(fingerprint({ b: 2, a: 1 }));
    expect(fingerprint([1, 2])).not.toBe(fingerprint([2, 1]));
  });
});
