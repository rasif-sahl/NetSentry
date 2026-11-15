export function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function boolean(value: unknown, name: string, fallback = false): boolean {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = text(value).toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  throw new Error(`${name} must be true or false.`);
}

function integer(
  value: unknown,
  name: string,
  fallback: number,
  max: number,
): number {
  const normalized = value === undefined ? fallback : Number(value);
  if (
    (typeof value === 'string' && !value.trim()) ||
    !Number.isInteger(normalized) ||
    normalized < 1 ||
    normalized > max
  ) {
    throw new Error(`${name} must be an integer between 1 and ${max}.`);
  }
  return normalized;
}

export function validateDatabaseEnvironment(input: Record<string, unknown>) {
  const mode = text(input.NODE_ENV, 'development');
  if (!['development', 'test', 'production'].includes(mode))
    throw new Error('NODE_ENV must be development, test or production.');
  const url = text(input.DATABASE_URL);
  try {
    const parsed = new URL(url);
    if (
      !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
      !parsed.hostname ||
      parsed.pathname.length < 2
    )
      throw new Error();
    // Keep TLS policy in explicit options; connection-string sslmode can override it in pg.
    if (
      [...parsed.searchParams.keys()].some((key) =>
        key.toLowerCase().startsWith('ssl'),
      )
    )
      throw new Error();
  } catch {
    throw new Error(
      'DATABASE_URL must identify a PostgreSQL database without SSL query parameters.',
    );
  }
  const synchronize = boolean(input.DB_SYNCHRONIZE, 'DB_SYNCHRONIZE');
  if (synchronize && mode !== 'development')
    throw new Error('DB_SYNCHRONIZE is only allowed in development.');
  const ssl = boolean(input.DATABASE_SSL, 'DATABASE_SSL');
  if (mode === 'production' && !ssl)
    throw new Error('DATABASE_SSL must be true in production.');
  return {
    ...input,
    NODE_ENV: mode,
    DATABASE_URL: url,
    DATABASE_SSL: ssl,
    DATABASE_SSL_CA: text(input.DATABASE_SSL_CA) || undefined,
    DB_SYNCHRONIZE: synchronize,
  };
}

export function validateEnvironment(input: Record<string, unknown>) {
  const database = validateDatabaseEnvironment(input);
  const accessSecret = text(input.JWT_ACCESS_TOKEN_SECRET);
  const refreshSecret = text(input.JWT_REFRESH_TOKEN_SECRET);
  for (const [name, value] of [
    ['JWT_ACCESS_TOKEN_SECRET', accessSecret],
    ['JWT_REFRESH_TOKEN_SECRET', refreshSecret],
  ]) {
    if (value.length < 32)
      throw new Error(`${name} must contain at least 32 characters.`);
    if (database.NODE_ENV === 'production' && /replace|change-me/i.test(value))
      throw new Error(`${name} must be replaced before production.`);
  }
  if (accessSecret === refreshSecret)
    throw new Error('JWT access and refresh secrets must be different.');
  const ttl = text(input.JWT_ACCESS_TOKEN_TTL, '15m');
  if (!/^[1-9]\d*(s|m|h|d)$/.test(ttl))
    throw new Error(
      'JWT_ACCESS_TOKEN_TTL must be a positive duration such as 15m.',
    );
  const prefix = text(input.API_PREFIX, 'api');
  if (!/^[a-z][a-z0-9-]*$/.test(prefix))
    throw new Error('API_PREFIX must be a single lowercase path segment.');
  const origins = text(input.CORS_ORIGINS, 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (!origins.length)
    throw new Error('CORS_ORIGINS must contain an explicit origin.');
  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.origin !== origin ||
        parsed.username ||
        parsed.password ||
        (database.NODE_ENV === 'production' && parsed.protocol !== 'https:')
      )
        throw new Error();
    } catch {
      throw new Error(
        'CORS_ORIGINS must contain exact HTTP origins, with HTTPS in production.',
      );
    }
  }
  return {
    ...database,
    PORT: integer(input.PORT, 'PORT', 3000, 65535),
    API_PREFIX: prefix,
    CORS_ORIGINS: [...new Set(origins)],
    JWT_ACCESS_TOKEN_SECRET: accessSecret,
    JWT_REFRESH_TOKEN_SECRET: refreshSecret,
    JWT_ACCESS_TOKEN_TTL: ttl,
    JWT_REFRESH_TOKEN_TTL_DAYS: integer(
      input.JWT_REFRESH_TOKEN_TTL_DAYS,
      'JWT_REFRESH_TOKEN_TTL_DAYS',
      30,
      365,
    ),
  };
}
