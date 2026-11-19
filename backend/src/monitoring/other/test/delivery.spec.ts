import { defaultAdapters } from '../delivery';
describe('disabled email alert transport', () => {
  it('cannot be activated by account-mail SMTP configuration', async () => {
    const previous = process.env.MAIL_ENABLED;
    process.env.MAIL_ENABLED = 'true';
    try {
      const adapter = defaultAdapters.find((a) => a.channel === 'email')!;
      expect(
        await adapter.deliver({
          idempotencyKey: 'fixture',
          alertId: 'fixture',
          userId: 'fixture',
        }),
      ).toEqual({ status: 'unavailable', code: 'EMAIL_DELIVERY_DISABLED' });
    } finally {
      if (previous === undefined) delete process.env.MAIL_ENABLED;
      else process.env.MAIL_ENABLED = previous;
    }
  });
});
