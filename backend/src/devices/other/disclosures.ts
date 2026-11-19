import { createHash } from 'node:crypto';
export const disclosures = {
  applications: {
    version: 'app-usage-v1',
    text: 'Additionally share observed application identifiers, permitted display labels and platform categories, foreground/screen intervals, observed foreground-entry counts and first/last use with authorized workspace report viewers. No activity class names, content or icons are uploaded. Raw timelines use the existing raw retention; daily summaries use aggregate retention. Classification is uncertain unless manually corrected. Counts describe observed foreground entries, not verified cold launches. You can pause, revoke or erase these records. Native accuracy remains subject to device validation.',
  },
  enrolment: {
    version: 'device-enrolment-v1',
    text: 'Pair this installation with your account and workspace. NetSentry may receive device/app version, permission, capability and synchronization-health information. Pairing does not enable usage monitoring or prove hardware identity.',
  },
  monitoring: {
    version: 'monitoring-v3',
    text: 'Allow authorized workspace report viewers to view the selected usage scopes. Default retention is 30 days for raw observations and 365 days for aggregates, configurable up to 90 and 730 days respectively. Minimal synchronization receipts and interval indexes remain for the aggregate retention period plus one day to prevent duplicate counting. Allow the selected usage scopes to be collected only through supported platform permissions. You can pause or revoke this choice. NetSentry does not read private messages, emails, passwords or HTTPS contents. Collection features remain unavailable until implemented and verified.',
  },
};
export const disclosureHash = (kind: keyof typeof disclosures) =>
  createHash('sha256').update(disclosures[kind].text).digest('hex');
