import type { EntityManager } from 'typeorm';
import { allocate, decimal, fingerprint, micro } from './values';
import { Measurement } from './entities';
export type DayPart = { localDate: string; milliseconds: number };
export async function dailyParts(
  manager: EntityManager,
  start: Date,
  end: Date,
  timezone: string,
): Promise<DayPart[]> {
  return manager.query(
    `SELECT d::date::text AS "localDate", (EXTRACT(EPOCH FROM (LEAST($2::timestamptz,(d+interval '1 day') AT TIME ZONE $3)-GREATEST($1::timestamptz,d AT TIME ZONE $3)))*1000)::float8 AS milliseconds FROM generate_series(($1::timestamptz AT TIME ZONE $3)::date::timestamp,(($2::timestamptz-interval '1 millisecond') AT TIME ZONE $3)::date::timestamp,interval '1 day') d ORDER BY d`,
    [start, end, timezone],
  );
}
export async function aggregate(
  manager: EntityManager,
  event: Measurement,
  timezone: string,
) {
  const parts = await dailyParts(
    manager,
    event.intervalStart,
    event.intervalEnd,
    timezone,
  );
  const values = allocate(
    micro(event.value),
    parts.map((part) => part.milliseconds),
  );
  const seriesKey = fingerprint([
    event.metric,
    event.applicationId,
    event.quality,
    event.sourceKind,
    event.collectorVersion,
    event.networkId,
    timezone,
  ]);
  for (let index = 0; index < parts.length; index++) {
    // Arithmetic upsert preserves exact micro-units and serializes concurrent contributions.
    await manager.query(
      `INSERT INTO daily_usage ("workspaceId","deviceId","networkId","seriesKey","localDate",timezone,metric,"applicationId",quality,"sourceKind","collectorVersion",value,"coverageMs","proratedEvents") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT ("deviceId","seriesKey","localDate") DO UPDATE SET value=daily_usage.value+EXCLUDED.value,"coverageMs"=daily_usage."coverageMs"+EXCLUDED."coverageMs","proratedEvents"=daily_usage."proratedEvents"+EXCLUDED."proratedEvents"`,
      [
        event.workspaceId,
        event.deviceId,
        event.networkId,
        seriesKey,
        parts[index].localDate,
        timezone,
        event.metric,
        event.applicationId,
        event.quality,
        event.sourceKind,
        event.collectorVersion,
        decimal(values[index]),
        String(parts[index].milliseconds),
        parts.length > 1 ? 1 : 0,
      ],
    );
  }
}
