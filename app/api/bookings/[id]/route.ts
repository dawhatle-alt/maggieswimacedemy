import { api, json, requireUser, body, str, fail } from '@/lib/server';
import { database } from '@/db';
import { transitionAllowed } from '@/lib/domain';
import { notifyBooking } from '@/lib/booking-emails';
export const dynamic = 'force-dynamic';
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    const u = await requireUser(),
      p = await body(req),
      { id } = await params;
    const b = await database()
      .prepare('SELECT * FROM bookings WHERE id=?')
      .bind(id)
      .first<any>();
    if (!b || (!u.isAdmin && b.user_id !== u.userId))
      fail('Booking not found.', 404);
    const status = str(p.status, 'status');
    if (!u.isAdmin && (status !== 'cancelled' || b.status !== 'pending'))
      fail('Contact Maggie to change a confirmed lesson.', 403);
    if (b.invoice_lock)
      fail('An invoice is being prepared. Try again shortly.', 409);
    if (!transitionAllowed(b.status, status, !!b.invoice_id, b.invoice_status))
      fail(
        'This change is unavailable. Cancel any outstanding Square invoice first and refresh its status.',
        409,
      );
    const r = await database()
      .prepare(
        'UPDATE bookings SET status=? WHERE id=? AND status=? AND invoice_lock IS NULL',
      )
      .bind(status, id, b.status)
      .run();
    if (!r.meta.changes)
      fail('The booking changed. Refresh and try again.', 409);
    const emailStatus = status === 'confirmed' ? await notifyBooking(id, 'confirmed') : undefined;
    return json({ ok: true, emailStatus });
  });
}
