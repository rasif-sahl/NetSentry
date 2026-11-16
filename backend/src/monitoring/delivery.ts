import type { Channel } from './alert.entities';
export type DeliveryResult = {
  status: 'delivered' | 'retry' | 'unavailable';
  code: string | null;
};
export interface NotificationAdapter {
  channel: Channel;
  deliver(input: {
    idempotencyKey: string;
    alertId: string;
    userId: string;
  }): Promise<DeliveryResult>;
}
// Push registration, secure tokens and provider credentials belong to the native delivery phase.
export const defaultAdapters: NotificationAdapter[] = [
  {
    channel: 'email',
    // Intentional hard stop: account mail/SMTP configuration cannot enable alerts.
    deliver: async () => ({
      status: 'unavailable',
      code: 'EMAIL_DELIVERY_DISABLED',
    }),
  },
  {
    channel: 'in_app',
    deliver: async () => ({ status: 'delivered', code: null }),
  },
  {
    channel: 'android_push',
    deliver: async () => ({
      status: 'unavailable',
      code: 'ANDROID_PROVIDER_UNCONFIGURED',
    }),
  },
  {
    channel: 'ios_push',
    deliver: async () => ({
      status: 'unavailable',
      code: 'IOS_PROVIDER_UNCONFIGURED',
    }),
  },
];
