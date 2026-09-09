# Maggie’s Swim Academy

A Next.js booking site deployed on Vercel, with Supabase email/Google sign-in, PostgreSQL booking storage, and Square invoices. Maggie controls lesson prices, lengths, locations, availability and approval. Parents can request a lesson at Forest Creek community pool or their home pool and see their own bookings.

## Fix for the Vercel 404

The original version built a Cloudflare Worker through Vinext. Vercel completed that build but had no compatible application output to serve. The current version uses native Next.js, Node runtime environment variables, and PostgreSQL instead of Cloudflare-only bindings.

`vercel.json` explicitly sets the Next.js framework, `npm ci`, `npm run build`, and `.next` output. Do not set the output to `dist`, `dist/client`, or `public`, and do not add a catch-all rewrite to `index.html`.

In Vercel, use repository root `./`, branch `main`, Framework Preset **Next.js**, and Node **22.x**. Redeploy the latest commit after adding environment variables. The old hosted Sites preview is separate and is not updated by this deployment.

The home page renders even before integrations are configured. New bookings remain closed until database setup and Maggie’s schedule are ready.

## Environment variables

Copy `.env.example` to `.env.local` for local development. In Vercel, set variables in Project Settings → Environment Variables, select the intended environments, and redeploy. Never commit credentials.

| Name | Value |
| --- | --- |
| `ADMIN_EMAILS` | Comma-separated verified emails permitted to manage lessons; you set these. Empty means no administrator. |
| `APP_URL` | `https://maggieswimacedemy.vercel.app` initially. Change to `https://maggieswimacademy.com` when that domain is connected. |
| `SUPABASE_URL` | Maggie’s Supabase project URL. |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key; no service-role key is needed for authentication. |
| `DATABASE_URL` | Server-only PostgreSQL connection string. For Supabase/Vercel, use the **transaction pooler** URL from Connect, normally port 6543, with the database-owner credentials. |
| `DATABASE_SSL_CA` | Optional PEM root certificate from the database provider if required for certificate verification. Do not disable TLS verification. |
| `RESEND_API_KEY` | Dedicated Resend sending key scoped to maggieswimacademy.com, for booking emails. Supabase SMTP uses its separate key for sign-in emails. |
| `BOOKING_EMAIL_FROM` | `Maggie’s Swim Academy <noreply@maggieswimacademy.com>` |
| `SQUARE_ACCESS_TOKEN` | Server-only Square token matching the chosen environment. |
| `SQUARE_LOCATION_ID` | Active Square location ID. |
| `SQUARE_ENVIRONMENT` | `sandbox` initially; `production` only after validating invoices. |

`AUTH_MODE=review` is no longer supported. Vercel never trusts client-supplied ChatGPT identity headers. Authentication always validates the Supabase user on the server.

## Set up the database

1. Select the Supabase project intended for Maggie’s business. Do not reuse another business’s database without intending to share that project.
2. Run [`db/postgres.sql`](db/postgres.sql), then `supabase/migrations/20260909013936_booking_notification_emails.sql` using the database-owner account. Existing installations apply only the new notification migration.
3. Put its transaction-pooler connection string into the Vercel `DATABASE_URL` environment variable. The app disables prepared-statement caching for pooler compatibility and uses a small connection pool.
4. Redeploy. The `/api/bootstrap` response reports `storageReady: true` when the connection is configured; a successful response also confirms the settings and lesson tables were queried.

The script creates a private `maggie` schema, enables row-level security, and denies public/browser API roles. The server connects as the database owner and enforces family ownership and admin access on every protected endpoint. Do not add `maggie` to Supabase’s exposed API schemas. Keep the database password server-only.

This creates empty tables; it does **not** transfer data from the former Sites D1 database. Existing D1 migration files under `drizzle/` are historical only and must not be run against PostgreSQL. If you entered real bookings in the old site, export and migrate them before switching live customer traffic.

PostgreSQL constraints prevent simultaneous double booking and overlapping active times, including travel buffers. Triggers serialize slot withdrawal with a new booking request. Existing bookings retain their original lesson price and duration.

## Configure email and Google login

Enable Email and Google in Supabase Authentication. Configure the Google provider using the callback URL Supabase supplies. Configure a production email sender for magic links.

Set the Supabase Site URL to `APP_URL` and allow the exact redirect URL `https://maggieswimacedemy.vercel.app/auth/complete`. Add the custom-domain equivalent when going live there. For local development, allow `http://localhost:3000/auth/complete` and use that origin for local `APP_URL`.

Test email and Google sign-in, sign-out, expired/reused links, two separate parent accounts, and Maggie’s admin email. Email links must be opened in the browser where they were requested.

## Booking notification emails

New requests and pending-to-confirmed approvals queue a customer email in the same database transaction. Emails contain the saved lesson name, swimmer first name, Central Time date/time, duration, location/address, price and portal link. Notes and phone numbers are omitted. The receipt explicitly says approval is still pending. These emails do not create or send Square invoices. Existing bookings are not backfilled.

The server immediately attempts delivery through Resend. A provider failure does not fail or roll back a saved booking; the family sees a delayed-email notice and Maggie sees pending emails under Requests & lessons. Use **Retry pending emails** to process up to three at a time. There is no scheduled retry job. Retries retain the exact payload and idempotency key, with a two-minute lease for interrupted attempts. Uncertain attempts older than 23 hours require checking Resend and contacting the family manually to avoid duplication after Resend’s 24-hour deduplication window. Superseded queued notifications are skipped. Resend acceptance is recorded; final mailbox delivery/bounces are checked in Resend.

The notification table uses a private schema, RLS and no browser-role grants. The application sends only to the booking’s verified account email. The Resend key stays server-side in Vercel.

## Configure Square

Use sandbox credentials first. Maggie approves a request, then explicitly creates its Square invoice. The app creates a customer, order, and invoice using idempotency keys. The invoice link appears in the family portal. Payment happens on Square; no saved card is charged by this app and no invoice email is sent automatically.

Refresh payment status in the portal/dashboard after payment. Refunds and invoice cancellations happen in Square. Cancel an outstanding invoice there and refresh its status before cancelling its lesson. Reconcile any interrupted invoice operation in Square before clearing a stuck invoice lock.

## First use

Maggie signs in with an email listed in `ADMIN_EMAILS`, adds lesson options, sets individual available times and travel buffers, and checks pool details. She then enables **Accept new lesson requests** in Settings. All requests await her approval. Parents receive a request summary by email, then a confirmation email when Maggie approves. The portal remains the authoritative current status. Confirmed rescheduling is arranged with Maggie, with cancellation and a new request.

## Development and checks

Use Node 22.x (22.18+ for the built-in TypeScript test runner) and npm:

- `npm ci`
- `npm test`
- `npm run build`
- `npm start` to test the production build, or `npm run dev` for development.

Tests use a local in-memory PostgreSQL engine; no external database is modified. They apply the actual PostgreSQL schema, parse production queries, and check travel-time exclusion, duplicate holds, owner-filtered queries, original pricing, cancellation/rebooking, RLS flags and Central Time/DST handling. Live Supabase, Square and real multi-connection load tests still require configured services.

The PostgreSQL schema file is the migration source. Subsequent changes to a populated database should use a new reviewed migration rather than editing already-applied table definitions.

## References

- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Supabase connection pooling](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase Google login](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Square Invoices API](https://developer.squareup.com/docs/invoices-api/overview)

The illustration is original AI-created artwork, not a photograph of Maggie or her customers.
