import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import type { AppMetadata } from '../entity/application.entities';
export type Segment = { start: string; end: string };
export type AppBatch = {
  schemaVersion: number;
  batchId: string;
  generation: number;
  workspaceId: string;
  deviceId: string;
  intervalStart: string;
  intervalEnd: string;
  collectedAt: string;
  screenKnown: boolean;
  appKnown: boolean;
  sessions: (Segment & { applicationId: string })[];
  screen: Segment[];
  launches: { applicationId: string; at: string }[];
  applications: AppMetadata[];
  issues: string[];
};
let check: ReturnType<Ajv2020['compile']> | undefined;
export function validateApplicationBatch(
  value: unknown,
): asserts value is AppBatch {
  if (!check) {
    const ajv = new Ajv2020({ strict: true });
    addFormats(ajv);
    const file = 'app-usage-batch.v1.schema.json',
      bundled = join(__dirname, '../../contracts', file);
    check = ajv.compile(
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
  if (!check(value))
    throw new BadRequestException(
      'Application usage does not match the supported schema.',
    );
  const batch = value as AppBatch,
    first = Date.parse(batch.intervalStart),
    last = Date.parse(batch.intervalEnd);
  if (
    last <= first ||
    last - first > 6 * 3600000 ||
    last > Date.now() ||
    Date.parse(batch.collectedAt) < last ||
    Date.parse(batch.collectedAt) > Date.now() + 300000
  )
    throw new BadRequestException(
      'Choose a past application window of at most six hours.',
    );
  const apps = batch.applications.map((a) => a.applicationId);
  if (new Set(apps).size !== apps.length)
    throw new BadRequestException('Application IDs must be unique.');
  for (const segment of [...batch.sessions, ...batch.screen])
    if (
      Date.parse(segment.start) < first ||
      Date.parse(segment.end) > last ||
      Date.parse(segment.end) <= Date.parse(segment.start)
    )
      throw new BadRequestException(
        'Timeline segment is outside its observation window.',
      );
  if (
    batch.applications.some(
      (a) =>
        !batch.sessions.some((s) => s.applicationId === a.applicationId) &&
        !batch.launches.some((l) => l.applicationId === a.applicationId),
    )
  )
    throw new BadRequestException(
      'Only applications observed in this window may include metadata.',
    );
  for (const app of batch.applications)
    if (app.label !== null && /[\p{Cc}]/u.test(app.label))
      throw new BadRequestException('Invalid application label.');
  for (const id of [
    ...batch.sessions.map((s) => s.applicationId),
    ...batch.launches.map((l) => l.applicationId),
  ])
    if (!apps.includes(id))
      throw new BadRequestException(
        'Timeline application metadata is missing.',
      );
  if (
    new Set(batch.launches.map((l) => l.applicationId + '/' + l.at)).size !==
    batch.launches.length
  )
    throw new BadRequestException(
      'Duplicate launch observations are not allowed.',
    );
  for (const launch of batch.launches)
    if (Date.parse(launch.at) < first || Date.parse(launch.at) >= last)
      throw new BadRequestException('Launch is outside its window.');
  for (const id of ['', ...apps]) {
    const segments = (
      id ? batch.sessions.filter((s) => s.applicationId === id) : batch.screen
    )
      .slice()
      .sort((a, b) => a.start.localeCompare(b.start));
    if (
      segments.some(
        (segment, index) =>
          index > 0 && segment.start < segments[index - 1].end,
      )
    )
      throw new BadRequestException(
        'Same-application and screen intervals must not overlap.',
      );
  }
}
