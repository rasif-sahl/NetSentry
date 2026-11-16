import { DataSource } from 'typeorm';
import { Workspace } from '../workspaces/workspace.entity';
import { MonitoringRun, RetentionPolicy } from './entities';
// Each pass is bounded. Repeated passes safely continue from the remaining rows.
export async function retainWorkspace(
  source: DataSource,
  workspaceId: string,
  now = new Date(),
) {
  return source.transaction(async (manager) => {
    const workspace = await manager.findOneOrFail(Workspace, {
      where: { id: workspaceId },
      lock: { mode: 'pessimistic_write' },
    });
    const policy =
      (await manager.findOneBy(RetentionPolicy, { workspaceId })) ??
      manager.create(RetentionPolicy, { workspaceId });
    const raw = new Date(now.getTime() - policy.rawDays * 86400000),
      aggregate = new Date(now.getTime() - policy.aggregateDays * 86400000),
      receipt = new Date(now.getTime() - (policy.aggregateDays + 1) * 86400000),
      diagnostic = new Date(now.getTime() - policy.diagnosticDays * 86400000);
    const counts: Record<string, number> = {};
    for (const [table, condition, args] of [
      [
        'application_windows',
        '"deviceId" IN (SELECT id FROM registered_devices WHERE "workspaceId"=$1) AND "intervalEnd"<=$2',
        [workspaceId, raw],
      ],
      [
        'application_days',
        '"deviceId" IN (SELECT id FROM registered_devices WHERE "workspaceId"=$1) AND "localDate"<($2::timestamptz AT TIME ZONE $3)::date',
        [workspaceId, aggregate, workspace.timezone],
      ],
      [
        'alerts',
        '"ruleId" IN (SELECT id FROM alert_rules WHERE "workspaceId"=$1) AND "createdAt"<$2',
        [workspaceId, new Date(now.getTime() - policy.alertDays * 86400000)],
      ],
      [
        'measurements',
        '"workspaceId"=$1 AND "intervalEnd"<=$2',
        [workspaceId, raw],
      ],
      [
        'collection_gaps',
        '"workspaceId"=$1 AND "intervalEnd"<=$2',
        [workspaceId, aggregate],
      ],
      [
        'daily_usage',
        '"workspaceId"=$1 AND "localDate"<($2::timestamptz AT TIME ZONE $3)::date',
        [workspaceId, aggregate, workspace.timezone],
      ],
      [
        'measurement_receipts',
        '"deviceId" IN (SELECT id FROM registered_devices WHERE "workspaceId"=$1) AND "receivedAt"<$2',
        [workspaceId, receipt],
      ],
      [
        'measurement_batches',
        '"deviceId" IN (SELECT id FROM registered_devices WHERE "workspaceId"=$1) AND "receivedAt"<$2',
        [workspaceId, receipt],
      ],
      [
        'monitoring_runs',
        '"workspaceId"=$1 AND "createdAt"<$2',
        [workspaceId, diagnostic],
      ],
    ] as [string, string, unknown[]][]) {
      const rows = await manager.query(
        `DELETE FROM ${table} WHERE id IN (SELECT id FROM ${table} WHERE ${condition} ORDER BY id LIMIT 1000) RETURNING id`,
        args,
      );
      counts[table] = Array.isArray(rows[0]) ? rows[0].length : rows.length;
    }
    await manager.save(
      manager.create(MonitoringRun, {
        workspaceId,
        deviceId: null,
        kind: 'retention',
        status: 'succeeded',
        errorCode: null,
      }),
    );
    return counts;
  });
}
