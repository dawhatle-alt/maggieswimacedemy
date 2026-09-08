import assert from 'node:assert/strict';
const origin = 'http://127.0.0.1:3001';
const people = {
  admin: ['test-admin', 'admin@example.test'],
  one: ['family-one', 'parent@example.test'],
  two: ['family-two', 'another@example.test'],
};
async function api(path, method = 'GET', body, who = 'admin', expected = 200) {
  const headers = { 'Content-Type': 'application/json', Origin: origin };
  if (who) {
    headers['oai-authenticated-user-id'] = people[who][0];
    headers['oai-authenticated-user-email'] = people[who][1];
  }
  const r = await fetch(origin + '/api/' + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  assert.equal(r.status, expected, JSON.stringify(d));
  return d;
}
await api('bookings', 'GET', undefined, null, 401);
await api('manage', 'GET', undefined, 'one', 403);
const settings = {
  action: 'settings',
  poolName: 'Test pool',
  poolAddress: 'Test address',
  homeArea: 'Round Rock',
  bufferMinutes: 15,
  open: true,
};
await api('manage', 'POST', settings);
const { id: serviceId } = await api('manage', 'POST', {
  action: 'service',
  name: 'TEST private lesson',
  description: 'Automated test fixture',
  duration: 30,
  price: 4500,
  active: true,
});
const { id: slotId } = await api(
  'manage',
  'POST',
  { action: 'slot', serviceId, start: '2027-09-10T09:00', location: 'both' },
  'admin',
  201,
);
await api(
  'manage',
  'POST',
  { action: 'slot', serviceId, start: '2027-09-10T09:30', location: 'both' },
  'admin',
  409,
);
const payload = {
  slotId,
  parent: 'Test parent',
  swimmer: 'Test swimmer',
  phone: '5551234567',
  location: 'home',
  address: 'Test pool address',
  notes: '',
  guardian: true,
};
const race = await Promise.all(
  ['one', 'two'].map(async (who) => {
    const r = await fetch(origin + '/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'oai-authenticated-user-id': people[who][0],
        'oai-authenticated-user-email': people[who][1],
      },
      body: JSON.stringify(payload),
    });
    return { status: r.status, body: await r.json(), who };
  }),
);
assert.deepEqual(race.map((x) => x.status).sort(), [201, 409]);
const winner = race.find((x) => x.status === 201),
  loser = winner.who === 'one' ? 'two' : 'one';
const id = winner.body.id;
assert.equal((await api('bookings', 'GET', undefined, loser)).length, 0);
await api('bookings/' + id, 'PATCH', { status: 'cancelled' }, loser, 404);
await api('bookings/' + id, 'PATCH', { status: 'confirmed' }, winner.who, 403);
await api('bookings/' + id, 'PATCH', { status: 'confirmed' });
await api('bookings/' + id, 'PATCH', { status: 'cancelled' }, winner.who, 403);
await api(
  'bookings/' + id + '/invoice',
  'POST',
  { action: 'create' },
  winner.who,
  403,
);
await api(
  'bookings/' + id + '/invoice',
  'POST',
  { action: 'create' },
  'admin',
  503,
);
await api('manage', 'POST', { action: 'removeSlot', id: slotId }, 'admin', 409);
await api('manage', 'POST', {
  action: 'service',
  id: serviceId,
  name: 'TEST private lesson',
  description: 'Updated test fixture',
  duration: 30,
  price: 6500,
  active: true,
});
assert.equal(
  (await api('bookings', 'GET', undefined, winner.who))[0].price,
  4500,
);
await api('bookings/' + id, 'PATCH', { status: 'cancelled' });
await api('manage', 'POST', { action: 'removeSlot', id: slotId });
await api('manage', 'POST', { ...settings, open: false });
const badOrigin = await fetch(origin + '/api/manage', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: 'https://untrusted.example',
    'oai-authenticated-user-id': 'test-admin',
    'oai-authenticated-user-email': 'admin@example.test',
  },
  body: JSON.stringify(settings),
});
assert.equal(badOrigin.status, 403);
console.log(
  'PASS: Worker API auth, admin isolation, concurrent booking race, buffer overlap, cross-family denial, status permissions, missing Square fail-closed, immutable price, cancellation, CSRF.',
);
