import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterDto } from './auth.dto';

describe('registration display names', () => {
  it.each(['  ', ' A '])('rejects %j after trimming', (displayName) => {
    const registration = plainToInstance(RegisterDto, {
      email: 'registration@example.invalid',
      displayName,
      password: 'fixture-password-1234',
    });

    expect(validateSync(registration).map((error) => error.property)).toEqual([
      'displayName',
    ]);
  });
});
