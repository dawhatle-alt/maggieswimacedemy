import {
  api,
  json,
  requireAdmin,
  body,
  str,
  num,
  config,
  fail,
} from '@/lib/server';
import { database } from '@/db';
import { centralToUtc } from '@/lib/domain';
export const dynamic = 'force-dynamic';
export async function GET() {
  return api(async () => {
    await requireAdmin();
    const db = database();
    const [bookings, services, slots] = await Promise.all([
      db.prepare('SELECT * FROM bookings ORDER BY start DESC LIMIT 1000').all(),
      db.prepare('SELECT * FROM services ORDER BY active DESC,name').all(),
      db
        .prepare(
          'SELECT s.*,v.name AS service_name FROM slots s JOIN services v ON v.id=s.service_id WHERE s.start>? ORDER BY s.start LIMIT 1000',
        )
        .bind(new Date().toISOString())
        .all(),
    ]);
    return json({
      bookings: bookings.results,
      services: services.results,
      slots: slots.results,
      settings: await config(),
    });
  });
}
export async function POST(req: Request) {
  return api(async () => {
    await requireAdmin();
    const p = await body(req);
    const db = database();
    if (p.action === 'settings') {
      const data = {
        poolName: str(p.poolName, 'pool name'),
        poolAddress: str(p.poolAddress, 'pool location', 300),
        homeArea: str(p.homeArea, 'service area'),
        bufferMinutes: num(p.bufferMinutes, 'travel buffer', 0, 120),
        open: p.open === true,
      };
      if (data.bufferMinutes % 5)
        fail('Use a buffer in five-minute increments.');
      await db
        .prepare(
          'INSERT INTO settings(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
        )
        .bind(JSON.stringify(data))
        .run();
      return json({ ok: true });
    }
    if (p.action === 'service') {
      const id = p.id ? str(p.id, 'lesson ID') : crypto.randomUUID();
      const name = str(p.name, 'lesson name', 100),
        description = str(p.description, 'description', 500);
      const duration = num(p.duration, 'lesson length', 10, 180),
        price = num(p.price, 'price', 0, 100000);
      if (duration % 5) fail('Use a length in five-minute increments.');
      const old = await db
        .prepare('SELECT duration FROM services WHERE id=?')
        .bind(id)
        .first<{ duration: number }>();
      if (old && old.duration !== duration) {
        const future = await db
          .prepare(
            'SELECT id FROM slots WHERE service_id=? AND start>? AND active=1 LIMIT 1',
          )
          .bind(id, new Date().toISOString())
          .first();
        if (future)
          fail(
            'Remove future availability before changing lesson length, or create a new lesson.',
          );
      }
      await db
        .prepare(
          'INSERT INTO services(id,name,description,duration,price,active) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,duration=excluded.duration,price=excluded.price,active=excluded.active',
        )
        .bind(
          id,
          name,
          description,
          duration,
          price,
          p.active === false ? 0 : 1,
        )
        .run();
      return json({ id });
    }
    if (p.action === 'slot') {
      const serviceId = str(p.serviceId, 'lesson'),
        start = centralToUtc(str(p.start, 'start time'));
      if (start <= new Date().toISOString()) fail('Choose a future time.');
      const service = await db
        .prepare('SELECT * FROM services WHERE id=? AND active=1')
        .bind(serviceId)
        .first<{ duration: number }>();
      if (!service) fail('Choose an active lesson.');
      const c = await config();
      const end = new Date(
        Date.parse(start) + service.duration * 60000,
      ).toISOString();
      const blocked = new Date(
        Date.parse(end) + c.bufferMinutes * 60000,
      ).toISOString();
      const location = str(p.location, 'location');
      if (!['community', 'home', 'both'].includes(location))
        fail('Choose a valid location.');
      const id = crypto.randomUUID();
      const r = await db
        .prepare(
          'INSERT INTO slots(id,service_id,start,end,blocked_until,location,active) SELECT ?,?,?,?,?,?,1 WHERE NOT EXISTS(SELECT 1 FROM slots WHERE active=1 AND start<? AND blocked_until>?)',
        )
        .bind(id, serviceId, start, end, blocked, location, blocked, start)
        .run();
      if (!r.meta.changes)
        fail('That time overlaps another lesson or its travel buffer.', 409);
      return json({ id }, 201);
    }
    if (p.action === 'removeSlot') {
      const id = str(p.id, 'time');
      const r = await db
        .prepare(
          "UPDATE slots SET active=0 WHERE id=? AND NOT EXISTS(SELECT 1 FROM bookings WHERE slot_id=? AND status IN ('pending','confirmed','completed'))",
        )
        .bind(id, id)
        .run();
      if (!r.meta.changes)
        fail(
          'A requested or confirmed lesson uses this time. Resolve the booking first.',
          409,
        );
      return json({ ok: true });
    }
    fail('Unknown action.');
  });
}
