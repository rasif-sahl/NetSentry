import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
export type EventInput = {
  schemaVersion: number;
  eventId: string;
  workspaceId: string;
  deviceId: string;
  metric: string;
  value: number;
  unit: string;
  source: { kind: string; collectorVersion: string };
  intervalStart: string;
  intervalEnd: string;
  collectedAt: string;
  quality: string;
  applicationId?: string;
};
export type GapInput = {
  gapId: string;
  metric: string;
  applicationId?: string;
  intervalStart: string;
  intervalEnd: string;
  reason: string;
};
export type BatchInput = {
  schemaVersion: number;
  batchId: string;
  generation: number;
  events: EventInput[];
  gaps: GapInput[];
};
let check: ReturnType<Ajv2020['compile']> | undefined;
export function validateBatch(value: unknown): asserts value is BatchInput {
  if (!check) {
    const ajv = new Ajv2020({ strict: true, strictRequired: false });
    addFormats(ajv);
    for (const file of [
      'measurement.v1.schema.json',
      'measurement-batch.v1.schema.json',
    ]) {
      const bundled = join(__dirname, '../../contracts', file);
      ajv.addSchema(
        JSON.parse(
          readFileSync(
            existsSync(bundled)
              ? bundled
              : join(__dirname, '../../../../contracts/schemas', file),
            'utf8',
          ),
        ),
      );
    }
    check = ajv.getSchema(
      'https://netsentry.example/schemas/measurement-batch.v1.json',
    )!;
  }
  if (!check(value))
    throw new BadRequestException(
      'Measurement batch does not match the supported schema.',
    );
  const batch = value as BatchInput;
  if (!batch.events.length && !batch.gaps.length)
    throw new BadRequestException(
      'A batch must contain observations or declared gaps.',
    );
  if (
    new Set(batch.events.map((event) => event.eventId)).size !==
      batch.events.length ||
    new Set(batch.gaps.map((gap) => gap.gapId)).size !== batch.gaps.length
  )
    throw new BadRequestException('Batch identifiers must be unique.');
}
