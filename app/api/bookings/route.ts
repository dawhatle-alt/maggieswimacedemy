import { api, json, requireUser, body, str, config, fail } from '@/lib/server';
import { database } from '@/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  return api(async () => {
    const u = await requireUser();
    return json(
      (
        await database()
          .prepare('SELECT * FROM bookings WHERE user_id=? ORDER BY start DESC')
          .bind(u.userId)
          .all()
      ).results,
    );
  });
}
export async function POST(req: Request) {
  return api(async () => {
    const u = await requireUser();
    const p = await body(req);
    const c = await config();
    if (!c.open)
      fail('Maggie has not opened booking yet. Please check back soon.', 409);
    const slot = str(p.slotId, 'time');
    const parent = str(p.parent, 'parent name', 100);
    const swimmer = str(p.swimmer, 'swimmer first name', 80);
    const phone = str(p.phone, 'phone number', 30);
    if (!/^[+()\d .-]{7,30}$/.test(phone)) fail('Enter a valid phone number.');
    const location = str(p.location, 'location');
    if (!['community', 'home'].includes(location))
      fail('Choose a lesson location.');
    const address =
      location === 'home'
        ? str(p.address, 'home pool address', 300)
        : c.poolAddress;
    const notes = str(p.notes ?? '', 'notes', 1200, true);
    if (p.guardian !== true)
      fail('Please confirm you are the swimmer’s parent or guardian.');
    const id = crypto.randomUUID();
    const r = await database()
      .prepare(
        `INSERT INTO bookings(id,slot_id,user_id,email,parent,swimmer,phone,location,address,notes,status,service_name,price,duration,start,end,created) SELECT ?,s.id,?,?,?,?,?,?,?,?,'pending',v.name,v.price,v.duration,s.start,s.end,? FROM slots s JOIN services v ON v.id=s.service_id WHERE s.id=? AND s.active=1 AND v.active=1 AND s.start>? AND (s.location=? OR s.location='both')`,
      )
      .bind(
        id,
        u.userId,
        u.email,
        parent,
        swimmer,
        phone,
        location,
        address,
        notes,
        new Date().toISOString(),
        slot,
        new Date().toISOString(),
        location,
      )
      .run();
    if (!r.meta.changes)
      fail('This time or location is no longer available.', 409);
    return json({ id, status: 'pending' }, 201);
  });
}
