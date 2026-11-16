import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { OperatorGrant } = require('../dist/operations/operations.entities.js');
const { Subscription } = require('../dist/billing/billing.entities.js');
export async function checkBilling({ request, source, alice, app }) {
  const previous = {
    mode: process.env.BILLING_MODE,
    enforcement: process.env.BILLING_ENFORCEMENT,
    secret: process.env.BILLING_EVENT_SECRET,
  };
  process.env.BILLING_MODE = 'sandbox';
  process.env.BILLING_EVENT_SECRET =
    'isolated-billing-signature-secret-123456789';
  process.env.BILLING_ENFORCEMENT = 'false';
  try {
    const owner = alice.accessToken,
      w = await request(
        'POST',
        '/workspaces',
        201,
        null,
        { name: 'Synthetic billing family', type: 'FAMILY', timezone: 'UTC' },
        owner,
      ),
      base = `/workspaces/${w.id}/billing`;
    const view = await request(
      'GET',
      base,
      200,
      'BillingOverview',
      null,
      owner,
    );
    assert.equal(view.entitlements.edition, 'free');
    assert.equal(view.entitlements.mode, 'sandbox');
    const trial = {
      requestId: randomUUID(),
      plan: 'family',
      interval: 'monthly',
      expectedRevision: 0,
    };
    const activeTrial = await request(
      'POST',
      base + '/trial',
      201,
      'BillingEntitlements',
      trial,
      owner,
    );
    assert.equal(activeTrial.status, 'trialing');
    assert.equal(
      (
        await request(
          'POST',
          base + '/trial',
          201,
          'BillingEntitlements',
          trial,
          owner,
        )
      ).revision,
      activeTrial.revision,
    );
    await request(
      'POST',
      base + '/trial',
      409,
      'ApiError',
      {
        ...trial,
        requestId: randomUUID(),
        expectedRevision: activeTrial.revision,
      },
      owner,
    );
    const checkout = {
      requestId: randomUUID(),
      plan: 'family',
      interval: 'annual',
      expectedRevision: activeTrial.revision,
    };
    const first = await request(
      'POST',
      base + '/checkout',
      201,
      null,
      checkout,
      owner,
    );
    assert.equal(
      (await request('POST', base + '/checkout', 201, null, checkout, owner))
        .id,
      first.id,
    );
    await request(
      'POST',
      base + '/checkout',
      409,
      'ApiError',
      { ...checkout, interval: 'monthly' },
      owner,
    );
    const paid = await request(
      'POST',
      base + '/sandbox/confirm',
      201,
      'BillingEntitlements',
      { requestId: checkout.requestId },
      owner,
    );
    assert.equal(paid.status, 'active');
    await request(
      'POST',
      base + '/sandbox/confirm',
      201,
      'BillingEntitlements',
      { requestId: checkout.requestId },
      owner,
    );
    assert.equal(
      (await request('GET', base, 200, 'BillingOverview', null, owner)).payments
        .length,
      1,
    );
    const cancelled = await request(
      'POST',
      base + '/cancel',
      201,
      'BillingEntitlements',
      { expectedRevision: paid.revision },
      owner,
    );
    assert.equal(cancelled.cancelAtPeriodEnd, true);
    await request(
      'POST',
      base + '/resume',
      201,
      'BillingEntitlements',
      { expectedRevision: cancelled.revision },
      owner,
    );
    async function event(body, status = 201, wrong = false) {
      const stamp = String(Math.floor(Date.now() / 1000)),
        signature = createHmac('sha256', process.env.BILLING_EVENT_SECRET)
          .update(stamp + '.' + JSON.stringify(body))
          .digest('hex');
      return request(
        'POST',
        '/billing/events',
        status,
        status === 201 ? null : 'ApiError',
        body,
        undefined,
        {
          'x-billing-timestamp': stamp,
          'x-billing-signature': wrong ? '0'.repeat(64) : signature,
        },
      );
    }
    const raw = {
      id: randomUUID(),
      workspaceId: w.id,
      sequence: 10,
      occurredAt: new Date().toISOString(),
      plan: 'family',
      interval: 'annual',
      status: 'past_due',
      periodEnd: new Date(Date.now() + 86400000).toISOString(),
      cancelAtPeriodEnd: false,
    };
    await event(raw, 401, true);
    await event(raw);
    assert.equal((await event(raw)).duplicate, true);
    await event({ ...raw, plan: 'business' }, 400); // Wrong plan/workspace binding, no cross-edition grant.
    await event({ ...raw, id: randomUUID(), sequence: 9, status: 'cancelled' });
    assert.equal(
      (
        await request(
          'GET',
          base + '/entitlements',
          200,
          'BillingEntitlements',
          null,
          owner,
        )
      ).status,
      'grace',
    );
    await event({ ...raw, id: randomUUID(), sequence: 10 }, 409);
    process.env.BILLING_ENFORCEMENT = 'true';
    const personal = (
      await request('GET', '/workspaces', 200, null, null, owner)
    ).find((x) => x.type === 'PERSONAL');
    await request(
      'POST',
      `/workspaces/${personal.id}/monitoring/networks`,
      403,
      'ApiError',
      { name: 'Free network is gated' },
      owner,
    );
    await request(
      'GET',
      `/workspaces/${personal.id}/devices`,
      200,
      null,
      null,
      owner,
    );
    await request(
      'POST',
      `/workspaces/${personal.id}/billing/checkout`,
      400,
      'ApiError',
      {
        requestId: randomUUID(),
        plan: 'business',
        interval: 'monthly',
        expectedRevision: 0,
      },
      owner,
    );
    await request('GET', '/operations', 403, 'ApiError', null, owner);
    const other = (
      await request('GET', '/workspaces', 200, null, null, owner)
    ).find((x) => x.id !== w.id);
    await source.getRepository(OperatorGrant).save({
      userId: alice.user.id,
      role: 'SUPPORT',
      workspaceIds: [w.id],
      expiresAt: new Date(Date.now() + 3600000),
      globalAccounts: false,
      globalCatalog: false,
    });
    const diagnostic = await request(
      'GET',
      `/operations/workspaces/${w.id}/diagnostics`,
      200,
      null,
      null,
      owner,
    );
    assert.deepEqual(Object.keys(diagnostic).sort(), [
      'counts',
      'generatedAt',
      'redacted',
      'schemaVersion',
      'workspaceId',
    ]);
    await request(
      'GET',
      `/operations/workspaces/${other.id}/diagnostics`,
      403,
      'ApiError',
      null,
      owner,
    );
    await request('GET', '/operations/users', 403, 'ApiError', null, owner);
    await source
      .getRepository(OperatorGrant)
      .update(
        { userId: alice.user.id },
        { role: 'ADMIN', globalCatalog: true },
      );
    const flag = {
      scope: 'workspace',
      workspaceId: w.id,
      key: 'family',
      enabled: false,
      expectedRevision: 0,
      password: 'wrong',
    };
    await request('POST', '/operations/flags', 401, 'ApiError', flag, owner);
    // Use a separate verified operator with known password; never rewrite an existing actor's credential.
    const operator = await app
      .get(require('../dist/auth/auth.service.js').AuthService)
      .register(
        {
          email: 'phase14-operator@example.invalid',
          displayName: 'Synthetic operator',
          password: 'synthetic-operator-password-123',
        },
        {},
      );
    await source.query('UPDATE users SET "emailVerifiedAt"=now() WHERE id=$1', [
      operator.user.id,
    ]);
    await source.getRepository(OperatorGrant).save({
      userId: operator.user.id,
      role: 'ADMIN',
      workspaceIds: [w.id],
      expiresAt: new Date(Date.now() + 3600000),
      globalAccounts: false,
      globalCatalog: true,
    });
    const configured = await request(
      'POST',
      '/operations/flags',
      201,
      null,
      { ...flag, password: 'synthetic-operator-password-123' },
      operator.accessToken,
    );
    assert.equal(configured.enabled, false);
    assert.equal(
      (
        await request(
          'GET',
          base + '/entitlements',
          200,
          'BillingEntitlements',
          null,
          owner,
        )
      ).features.family,
      false,
    );
    await request(
      'GET',
      `/workspaces/${w.id}/family`,
      403,
      'ApiError',
      null,
      owner,
    );
    await request(
      'POST',
      '/operations/flags',
      409,
      'ApiError',
      { ...flag, password: 'synthetic-operator-password-123' },
      operator.accessToken,
    );
    await request(
      'POST',
      '/operations/compatibility',
      201,
      null,
      {
        key: 'synthetic-router',
        kind: 'router',
        label: 'Synthetic router fixture',
        status: 'candidate',
        evidence: 'Protocol fixture only; no hardware acceptance',
        expectedRevision: 0,
        password: 'synthetic-operator-password-123',
      },
      operator.accessToken,
    );
    await request(
      'GET',
      '/operations/users',
      403,
      'ApiError',
      null,
      operator.accessToken,
    );
    const privateWorkspace = (
      await request('GET', '/workspaces', 200, null, null, operator.accessToken)
    ).find((x) => x.type === 'PERSONAL');
    const devices = app.get(
      require('../dist/devices/device.service.js').DeviceService,
    );
    const codes = [];
    for (let n = 0; n < 3; n++)
      codes.push(
        await devices.issue(operator.user.id, {
          workspaceId: privateWorkspace.id,
          installationId: randomUUID(),
          platform: 'ANDROID',
        }),
      );
    const allocations = await Promise.allSettled(
      codes.map((code, n) =>
        devices.enrol(operator.user.id, {
          token: code.token,
          name: 'Synthetic quota phone ' + n,
          accepted: true,
          disclosureVersion: 'device-enrolment-v1',
        }),
      ),
    );
    assert.equal(allocations.filter((x) => x.status === 'fulfilled').length, 2);
    assert.equal(allocations.filter((x) => x.status === 'rejected').length, 1);
    await source
      .getRepository(OperatorGrant)
      .update({ userId: operator.user.id }, { globalAccounts: true });
    const victim = await app
      .get(require('../dist/auth/auth.service.js').AuthService)
      .register(
        {
          email: 'phase14-victim@example.invalid',
          displayName: 'Synthetic suspension target',
          password: 'synthetic-victim-password-123',
        },
        {},
      );
    await source.query('UPDATE users SET "emailVerifiedAt"=now() WHERE id=$1', [
      victim.user.id,
    ]);
    await request(
      'POST',
      `/operations/users/${operator.user.id}/status`,
      403,
      'ApiError',
      { status: 'SUSPENDED', password: 'synthetic-operator-password-123' },
      operator.accessToken,
    );
    await request(
      'POST',
      `/operations/users/${victim.user.id}/status`,
      201,
      null,
      { status: 'SUSPENDED', password: 'synthetic-operator-password-123' },
      operator.accessToken,
    );
    await request('GET', '/auth/me', 401, 'ApiError', null, victim.accessToken);
    await request(
      'POST',
      `/operations/users/${victim.user.id}/status`,
      201,
      null,
      { status: 'ACTIVE', password: 'synthetic-operator-password-123' },
      operator.accessToken,
    );
    await request('GET', '/auth/me', 401, 'ApiError', null, victim.accessToken);
    await source
      .getRepository(OperatorGrant)
      .update(
        { userId: operator.user.id },
        { expiresAt: new Date(Date.now() - 1) },
      );
    await request(
      'GET',
      '/operations',
      403,
      'ApiError',
      null,
      operator.accessToken,
    );
    const { maintainOperations } = require('../dist/operations/maintenance.js');
    const {
      OperatorAudit,
    } = require('../dist/operations/operations.entities.js');
    const oldAudit = await source
      .getRepository(OperatorAudit)
      .save({
        actorId: operator.user.id,
        workspaceId: w.id,
        action: 'synthetic_expired_audit',
        occurredAt: new Date(Date.now() - 91 * 86400000),
      });
    const cleanup = await maintainOperations(source);
    assert.ok(cleanup.expiredGrants >= 1);
    assert.ok(cleanup.expiredAudit >= 1);
    assert.equal(
      await source
        .getRepository(OperatorGrant)
        .countBy({ userId: operator.user.id }),
      0,
    );
    assert.equal(
      await source.getRepository(OperatorAudit).countBy({ id: oldAudit.id }),
      0,
    );
    assert.ok(
      (await source
        .getRepository(OperatorAudit)
        .countBy({ action: 'feature_setting_changed' })) > 0,
    );
    process.env.BILLING_MODE = 'disabled';
    const afterMode = await request(
      'GET',
      base + '/entitlements',
      200,
      'BillingEntitlements',
      null,
      owner,
    );
    assert.equal(afterMode.edition, 'free');
    assert.equal(afterMode.status, 'provider_unavailable');
    await request(
      'POST',
      base + '/checkout',
      403,
      'ApiError',
      { ...checkout, requestId: randomUUID() },
      owner,
    );
    console.log(
      'Provider-neutral billing/operations checks passed: trial idempotency, monthly/annual checkout, single payment ledger, cancellation/resume, signed event tamper/replay/order/conflicts, grace, feature enforcement, preserved reads, expiring scoped operators, fresh-password flags and compatibility metadata. No live payment or verified hardware is implied.',
    );
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      const env = {
        mode: 'BILLING_MODE',
        enforcement: 'BILLING_ENFORCEMENT',
        secret: 'BILLING_EVENT_SECRET',
      }[key];
      if (value === undefined) delete process.env[env];
      else process.env[env] = value;
    }
  }
}
