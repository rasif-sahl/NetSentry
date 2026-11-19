import {
  contains,
  prefix,
  routerURL,
  counter,
  encryptRouter,
  decryptRouter,
} from './network-values';
describe('private network boundaries and encrypted router credentials', () => {
  const original = process.env.ROUTER_CREDENTIAL_ENCRYPTION_KEY;
  afterEach(() => {
    if (original === undefined)
      delete process.env.ROUTER_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.ROUTER_CREDENTIAL_ENCRYPTION_KEY = original;
  });
  it('rejects prefixes that leave private space, hostnames, public IPs and non-HTTPS router endpoints', () => {
    for (const value of [
      '192.168.1.0/15',
      '172.16.0.0/11',
      '10.0.0.0/7',
      '127.0.0.0/8',
      '10.1.1.1/32',
      '::1/24',
    ])
      expect(() => prefix(value)).toThrow();
    expect(contains(['192.168.1.0/24'], '192.168.1.20')).toBe(true);
    for (const value of [
      'http://192.168.1.1/ubus',
      'https://example.com/ubus',
      'https://192.168.2.1/ubus',
      'https://192.168.1.1/ubus?x=1',
      'https://user:secret@192.168.1.1/ubus',
      'https://127.0.0.1/ubus',
      'https://192.168.1.1/anything',
    ])
      expect(() => routerURL(value, ['192.168.1.0/24'])).toThrow();
    expect(routerURL('https://192.168.1.1/ubus', ['192.168.1.0/24'])).toBe(
      'https://192.168.1.1/ubus',
    );
  });
  it('preserves exact uint64 counters and rejects malformed values', () => {
    expect(counter('18446744073709551615')).toBe(18446744073709551615n);
    expect(counter(null)).toBeNull();
    for (const value of ['18446744073709551616', '-1', '01', '1.2', '1e3'])
      expect(() => counter(value)).toThrow();
  });
  it('encrypts with fresh nonces and binds each ciphertext to its router ID', () => {
    process.env.ROUTER_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString(
      'base64',
    );
    const secret = {
      username: 'fixture',
      password: 'private-fixture-password',
    };
    const a = encryptRouter('router-a', secret),
      b = encryptRouter('router-a', secret);
    expect(a).not.toBe(b);
    expect(a).not.toContain(secret.password);
    expect(decryptRouter('router-a', a)).toEqual(secret);
    expect(() => decryptRouter('router-b', a)).toThrow();
    process.env.ROUTER_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString(
      'base64',
    );
    expect(() => decryptRouter('router-a', a)).toThrow();
    delete process.env.ROUTER_CREDENTIAL_ENCRYPTION_KEY;
    expect(() => encryptRouter('router-a', secret)).toThrow();
  });
});
