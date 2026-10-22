const truthy = new Set(['1', 'true', 'yes']);

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export function validateEnvironment(input: Record<string, unknown>) {
  const required = [
    'DATABASE_URL',
    'JWT_ACCESS_TOKEN_SECRET',
    'JWT_REFRESH_TOKEN_SECRET',
  ] as const;

  for (const key of required) {
    const value = stringValue(input[key]).trim();
    if (!value) throw new Error(`${key} is required.`);
    if (key.includes('SECRET') && value.length < 32) {
      throw new Error(`${key} must contain at least 32 characters.`);
    }
  }

  return {
    ...input,
    PORT: Number(input.PORT ?? 3000),
    API_PREFIX: stringValue(input.API_PREFIX, 'api'),
    CORS_ORIGINS: stringValue(input.CORS_ORIGINS, 'http://localhost:3001')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    DATABASE_SSL: truthy.has(stringValue(input.DATABASE_SSL).toLowerCase()),
    DB_SYNCHRONIZE: truthy.has(stringValue(input.DB_SYNCHRONIZE).toLowerCase()),
    JWT_ACCESS_TOKEN_TTL: stringValue(input.JWT_ACCESS_TOKEN_TTL, '15m'),
    JWT_REFRESH_TOKEN_TTL_DAYS: Number(input.JWT_REFRESH_TOKEN_TTL_DAYS ?? 30),
  };
}
