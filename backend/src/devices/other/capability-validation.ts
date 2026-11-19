import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
type Report = {
  workspaceId: string;
  deviceId: string;
  reportedAt: string;
  capabilities: { id: string; checkedAt: string }[];
};
let validate: ReturnType<Ajv2020['compile']> | undefined;
export function validateCapabilityReport(
  report: unknown,
  workspaceId: string,
  deviceId: string,
): void {
  if (!validate) {
    const ajv = new Ajv2020({ strict: true, strictRequired: false });
    addFormats(ajv);
    const bundled = join(
      __dirname,
      '../../contracts/device-capabilities.v1.schema.json',
    );
    const source = join(
      __dirname,
      '../../../../contracts/schemas/device-capabilities.v1.schema.json',
    );
    validate = ajv.compile(
      JSON.parse(readFileSync(existsSync(bundled) ? bundled : source, 'utf8')),
    );
  }
  if (!validate(report))
    throw new BadRequestException(
      'Capability report does not match the supported schema.',
    );
  const value = report as Report;
  if (
    value.workspaceId !== workspaceId ||
    value.deviceId !== deviceId ||
    Date.parse(value.reportedAt) > Date.now() + 300000 ||
    value.capabilities.some(
      (capability) =>
        Date.parse(capability.checkedAt) > Date.parse(value.reportedAt),
    ) ||
    new Set(value.capabilities.map((capability) => capability.id)).size !==
      value.capabilities.length
  )
    throw new BadRequestException(
      'Capability identity or observation times are invalid.',
    );
}
