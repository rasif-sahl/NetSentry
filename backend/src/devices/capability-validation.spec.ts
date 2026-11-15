import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateCapabilityReport } from './capability-validation';
const fixture = () =>
  JSON.parse(
    readFileSync(
      join(
        __dirname,
        '../../../contracts/fixtures/device-capabilities.v1.json',
      ),
      'utf8',
    ),
  );
describe('device capability boundary', () => {
  it('accepts the shared contract fixture through the source-schema fallback', () => {
    const report = fixture();
    expect(() =>
      validateCapabilityReport(report, report.workspaceId, report.deviceId),
    ).not.toThrow();
  });
  it('rejects foreign device identity and duplicate capabilities', () => {
    const report = fixture();
    expect(() =>
      validateCapabilityReport(report, report.workspaceId, 'another-device'),
    ).toThrow();
    report.capabilities.push(structuredClone(report.capabilities[0]));
    expect(() =>
      validateCapabilityReport(report, report.workspaceId, report.deviceId),
    ).toThrow();
  });
  it('rejects future observations and unsupported executable actions', () => {
    const report = fixture();
    report.reportedAt = new Date(Date.now() + 600000).toISOString();
    expect(() =>
      validateCapabilityReport(report, report.workspaceId, report.deviceId),
    ).toThrow();
    const unavailable = fixture();
    unavailable.capabilities[0].availableActions = ['measure'];
    expect(() =>
      validateCapabilityReport(
        unavailable,
        unavailable.workspaceId,
        unavailable.deviceId,
      ),
    ).toThrow();
  });
});
