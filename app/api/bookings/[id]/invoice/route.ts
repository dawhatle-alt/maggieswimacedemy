import { api, json, requireUser, body, fail, settingEnv } from '@/lib/server';
import { database } from '@/db';
import { square } from '@/lib/square';
export const dynamic = 'force-dynamic';
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    const u = await requireUser(),
      p = await body(req),
      { id } = await params,
      db = database();
    const b = await db
      .prepare('SELECT * FROM bookings WHERE id=?')
      .bind(id)
      .first<any>();
    if (!b || (!u.isAdmin && b.user_id !== u.userId))
      fail('Booking not found.', 404);
    if (p.action === 'refresh') {
      if (!b.invoice_id) fail('No invoice exists yet.');
      const { invoice } = await square(
        '/invoices/' + encodeURIComponent(b.invoice_id),
      );
      await db
        .prepare(
          'UPDATE bookings SET invoice_status=?,invoice_url=? WHERE id=?',
        )
        .bind(invoice.status, invoice.public_url || null, id)
        .run();
      return json({ ok: true });
    }
    if (!u.isAdmin) fail('Only Maggie can create invoices.', 403);
    if (p.action !== 'create') fail('Unknown invoice action.');
    if (!['confirmed', 'completed'].includes(b.status))
      fail('Approve the lesson before invoicing.');
    if (b.price <= 0) fail('A free lesson does not need an invoice.');
    if (b.invoice_id && b.invoice_status !== 'DRAFT') return json({ ok: true });
    if (!settingEnv('SQUARE_ACCESS_TOKEN') || !settingEnv('SQUARE_LOCATION_ID'))
      fail('Square is not connected yet.', 503);
    const lock = crypto.randomUUID();
    const locked = await db
      .prepare(
        "UPDATE bookings SET invoice_lock=? WHERE id=? AND invoice_lock IS NULL AND status IN ('confirmed','completed')",
      )
      .bind(lock, id)
      .run();
    if (!locked.meta.changes)
      fail(
        'An invoice is already being prepared. Refresh before retrying.',
        409,
      );
    try {
      let invoice: any;
      if (b.invoice_id) {
        invoice = (
          await square('/invoices/' + encodeURIComponent(b.invoice_id))
        ).invoice;
      } else {
        const { customer } = await square('/customers', {
          idempotency_key: 'customer-' + id,
          given_name: b.parent,
          email_address: b.email,
          reference_id: id,
        });
        const { order } = await square('/orders', {
          idempotency_key: 'order-' + id,
          order: {
            location_id: settingEnv('SQUARE_LOCATION_ID'),
            customer_id: customer.id,
            reference_id: id,
            line_items: [
              {
                name: b.service_name,
                quantity: '1',
                base_price_money: { amount: b.price, currency: 'USD' },
              },
            ],
          },
        });
        const due = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'America/Chicago',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(Math.max(Date.now(), Date.parse(b.start))));
        invoice = (
          await square('/invoices', {
            idempotency_key: 'invoice-' + id,
            invoice: {
              location_id: settingEnv('SQUARE_LOCATION_ID'),
              order_id: order.id,
              primary_recipient: { customer_id: customer.id },
              delivery_method: 'SHARE_MANUALLY',
              payment_requests: [
                {
                  request_type: 'BALANCE',
                  due_date: due,
                  automatic_payment_source: 'NONE',
                },
              ],
              accepted_payment_methods: { card: true },
              title: "Maggie's Swim Academy — " + b.service_name,
              store_payment_method_enabled: false,
            },
          })
        ).invoice;
        await db
          .prepare(
            'UPDATE bookings SET invoice_id=?,invoice_status=? WHERE id=?',
          )
          .bind(invoice.id, invoice.status, id)
          .run();
      }
      if (invoice.status === 'DRAFT')
        invoice = (
          await square(
            '/invoices/' + encodeURIComponent(invoice.id) + '/publish',
            { version: invoice.version, idempotency_key: 'publish-' + id },
          )
        ).invoice;
      await db
        .prepare(
          'UPDATE bookings SET invoice_id=?,invoice_url=?,invoice_status=? WHERE id=?',
        )
        .bind(invoice.id, invoice.public_url || null, invoice.status, id)
        .run();
      return json({ ok: true });
    } finally {
      await db
        .prepare(
          'UPDATE bookings SET invoice_lock=NULL WHERE id=? AND invoice_lock=?',
        )
        .bind(id, lock)
        .run();
    }
  });
}
