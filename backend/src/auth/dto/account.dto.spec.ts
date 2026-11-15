import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PreferencesDto } from './account.dto';
describe('account preference input', () => {
  it('rejects arrays where a notification settings object is required', () => {
    expect(
      validateSync(plainToInstance(PreferencesDto, { notifications: [] }))
        .length,
    ).toBeGreaterThan(0);
  });
  it('rejects nested privilege fields instead of storing them as preferences', () => {
    expect(
      validateSync(
        plainToInstance(PreferencesDto, {
          notifications: { push: false, role: 'OWNER' },
        }),
        { whitelist: true, forbidNonWhitelisted: true },
      ).length,
    ).toBeGreaterThan(0);
  });
});
