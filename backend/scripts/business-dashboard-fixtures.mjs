import { randomUUID } from 'node:crypto';
export async function seedBusiness({ call, source, owner, accounts }) {
  const organization = await call(
    '/workspaces',
    'POST',
    {
      name: 'Fixture Business organization',
      type: 'BUSINESS',
      timezone: 'UTC',
    },
    owner.accessToken,
  );
  for (const [name, role] of [
    ['employee', 'EMPLOYEE'],
    ['businessAnalyst', 'ANALYST'],
    ['businessNetwork', 'NETWORK_ADMIN'],
  ])
    await source.query(
      'INSERT INTO memberships ("workspaceId","userId",role) VALUES ($1,$2,$3)',
      [organization.id, accounts[name].user.id, role],
    );
  const base = `/workspaces/${organization.id}/business`;
  const location = await call(
    base + '/locations',
    'POST',
    { name: 'Fixture office', expectedRevision: 0 },
    owner.accessToken,
  );
  const department = await call(
    base + '/departments',
    'POST',
    {
      name: 'Fixture engineering',
      locationId: location.id,
      expectedRevision: 0,
    },
    owner.accessToken,
  );
  const employee = await call(
    base + '/employees',
    'POST',
    { userId: accounts.employee.user.id, departmentId: department.id },
    owner.accessToken,
  );
  const code = await call(
    '/devices/enrolments',
    'POST',
    {
      workspaceId: organization.id,
      installationId: randomUUID(),
      platform: 'ANDROID',
    },
    accounts.employee.accessToken,
  );
  const pair = await call(
    '/devices/enrol',
    'POST',
    {
      token: code.token,
      name: 'Synthetic employee phone',
      accepted: true,
      disclosureVersion: 'device-enrolment-v1',
    },
    accounts.employee.accessToken,
  );
  await call(
    `${base}/devices/${pair.device.id}/assignment`,
    'POST',
    { employeeId: employee.id, expectedRevision: 0 },
    owner.accessToken,
  );
  const network = await call(
    `/workspaces/${organization.id}/networks`,
    'POST',
    { name: 'Synthetic business LAN', cidrs: ['192.168.70.0/24'] },
    owner.accessToken,
  );
  await call(
    `${base}/networks/${network.networkId}/location`,
    'PATCH',
    { locationId: location.id },
    owner.accessToken,
  );
  await call(
    base + '/compliance-policy',
    'POST',
    {
      expectedRevision: 0,
      staleMinutes: 1440,
      requireMonitoring: true,
      requirePermission: true,
    },
    owner.accessToken,
  );
  await source.query(
    `INSERT INTO network_endpoints ("networkId",identity,name,"firstSeenAt","lastSeenAt") VALUES ($1,$2,'Synthetic office printer',now(),now())`,
    [network.networkId, randomUUID()],
  );
  return {
    workspaceId: organization.id,
    employeeId: employee.id,
    deviceId: pair.device.id,
    locationId: location.id,
    departmentId: department.id,
    networkId: network.networkId,
  };
}
