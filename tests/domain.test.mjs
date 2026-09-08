import assert from 'node:assert/strict';
import { centralToUtc, transitionAllowed } from '../lib/domain.ts';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
assert.equal(centralToUtc('2026-09-10T09:00'), '2026-09-10T14:00:00.000Z');
assert.equal(centralToUtc('2026-12-10T09:00'), '2026-12-10T15:00:00.000Z');
assert.throws(() => centralToUtc('2027-03-14T02:30'));
assert.throws(() => centralToUtc('2026-11-01T01:30'));
assert.throws(() => centralToUtc('2026-02-30T10:00'));
assert.equal(transitionAllowed('pending', 'confirmed', false), true);
assert.equal(transitionAllowed('declined', 'confirmed', false), false);
assert.equal(
  transitionAllowed('confirmed', 'cancelled', true, 'UNPAID'),
  false,
);
assert.equal(
  transitionAllowed('confirmed', 'cancelled', true, 'CANCELED'),
  true,
);
const db = new DatabaseSync(':memory:');
db.exec(
  readFileSync(
    new URL('../drizzle/0000_minor_fenris.sql', import.meta.url),
    'utf8',
  ),
);
db.prepare('INSERT INTO services VALUES(?,?,?,?,?,?)').run(
  'lesson',
  'Swim',
  'Private swim',
  30,
  4000,
  1,
);
db.prepare('INSERT INTO slots VALUES(?,?,?,?,?,?,?)').run(
  'slot',
  'lesson',
  '2026-09-10T14:00:00.000Z',
  '2026-09-10T14:30:00.000Z',
  '2026-09-10T14:45:00.000Z',
  'both',
  1,
);
const insert = db.prepare(
  'INSERT INTO bookings(id,slot_id,user_id,email,parent,swimmer,phone,location,address,notes,status,service_name,price,duration,start,end,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
);
const record = [
  'first',
  'slot',
  'family-one',
  'parent@example.test',
  'Parent',
  'Swimmer',
  '5551234567',
  'home',
  'test',
  '',
  'pending',
  'Swim',
  4000,
  30,
  '2026-09-10T14:00:00.000Z',
  '2026-09-10T14:30:00.000Z',
  '2026-09-04',
];
insert.run(...record);
assert.throws(() => insert.run('second', ...record.slice(1)), /UNIQUE/);
assert.equal(
  db
    .prepare('SELECT count(*) AS n FROM bookings WHERE user_id=?')
    .get('family-two').n,
  0,
);
db.prepare('UPDATE services SET price=6000 WHERE id=?').run('lesson');
assert.equal(
  db.prepare('SELECT price FROM bookings WHERE id=?').get('first').price,
  4000,
);
db.prepare("UPDATE bookings SET status='cancelled' WHERE id=?").run('first');
insert.run('second', ...record.slice(1));
assert.equal(
  db.prepare("SELECT count(*) AS n FROM bookings WHERE status='pending'").get()
    .n,
  1,
);
db.close();
console.log(
  'PASS: Central Time/DST, state transitions, duplicate holds, family ownership, immutable pricing, released times.',
);
