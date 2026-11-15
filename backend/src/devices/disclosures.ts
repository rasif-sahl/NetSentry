import { createHash } from 'node:crypto';
export const disclosures = {
  enrolment: {
    version: 'device-enrolment-v1',
    text: 'Pair this installation with your account and workspace. NetSentry may receive device/app version, permission, capability and synchronization-health information. Pairing does not enable usage monitoring or prove hardware identity.',
  },
  monitoring: {
    version: 'monitoring-v1',
    text: 'Allow the selected usage scopes to be collected only through supported platform permissions. You can pause or revoke this choice. NetSentry does not read private messages, emails, passwords or HTTPS contents. Collection features remain unavailable until implemented and verified.',
  },
};
export const disclosureHash = (kind: keyof typeof disclosures) =>
  createHash('sha256').update(disclosures[kind].text).digest('hex');
