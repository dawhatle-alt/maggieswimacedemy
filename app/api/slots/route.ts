import { api, json, str } from '@/lib/server';
import { database } from '@/db';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  return api(async () => {
    const service = str(new URL(req.url).searchParams.get('service'), 'lesson');
    return json(
      (
        await database()
          .prepare(
            "SELECT s.* FROM slots s JOIN services v ON v.id=s.service_id WHERE s.service_id=? AND s.active=1 AND v.active=1 AND s.start>? AND NOT EXISTS(SELECT 1 FROM bookings b WHERE b.slot_id=s.id AND b.status IN ('pending','confirmed','completed')) ORDER BY s.start LIMIT 180",
          )
          .bind(service, new Date().toISOString())
          .all()
      ).results,
    );
  });
}
