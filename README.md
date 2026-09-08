# Maggie’s Swim Academy

A bright, responsive swim-lesson booking site for Forest Creek / Round Rock, Texas. The requested domain and repository spelling are preserved as `maggieswimacedemy.com` and `dawhatle-alt/maggieswimacedemy`. Display branding uses “Maggie’s Swim Academy.”

## Implemented

- Parents choose a lesson, available time, and community or home pool; send a request; see their own bookings and Square invoice links.
- Maggie sets lesson names, descriptions, lengths, prices, available times, pool details, home service area, and travel buffers. She opens/closes requests, approves/declines/cancels bookings, and marks lessons completed.
- Pending requests reserve a time until Maggie reviews them. Database uniqueness prevents concurrent double booking. Creating availability atomically rejects overlaps including travel buffers.
- Central Time is fixed to America/Chicago, with daylight-saving validation. Existing bookings retain their original lesson price and duration.
- Email magic links and Google OAuth through Supabase Auth, using server-validated identities and cookie sessions. No child accounts or passwords are stored by this app.
- Square creates customers, orders, and invoices with stable idempotency keys. Invoices use SHARE_MANUALLY: they appear in the family portal; this app does not send invoice emails or charge saved cards. Payment status refreshes on demand. Cancel an outstanding invoice in Square and refresh its status before cancelling the related lesson.

## Current launch status

The application builds and core API tests pass. It is a private review, not a launched public booking service. No real lesson prices, availability, customers, or bookings have been seeded. Parent login requires Supabase configuration; Google requires its provider configuration, and production magic links require an email sender. Square requires credentials and sandbox validation. Management stays locked until ADMIN_EMAILS is set. The custom domain has not been attached or changed.

No automatic approval email, SMS reminder, cancellation/refund automation, or recurring lesson series is included in this simplified version. Parents check the portal for approval. Maggie adds individual available lesson times. Rescheduling is handled by cancelling and making a new request; confirmed changes need Maggie.

## Environment

Copy `.env.example` to `.env` locally. In hosting, set the same values as runtime environment variables and redeploy. Never commit `.env`. Keep all secrets out of the browser and repository.

| Variable                 | Purpose                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| ADMIN_EMAILS             | Comma-separated verified email addresses allowed to manage Maggie’s lessons. Empty means no administrator.                       |
| AUTH_MODE                | `supabase` for real parents; `review` explicitly uses Sites ChatGPT sign-in for private review only.                             |
| APP_URL                  | Exact public origin, without a trailing slash. For this domain: `https://maggieswimacedemy.com`. Local: `http://localhost:3000`. |
| SUPABASE_URL             | Your Supabase project URL.                                                                                                       |
| SUPABASE_PUBLISHABLE_KEY | Supabase publishable key. A service-role key is not needed.                                                                      |
| SQUARE_ACCESS_TOKEN      | Server-only Square access token, matching the selected environment.                                                              |
| SQUARE_LOCATION_ID       | Active Square location for invoices.                                                                                             |
| SQUARE_ENVIRONMENT       | `sandbox` initially; `production` only after validation.                                                                         |

## Connect parent sign-in

1. Create/select the Supabase project for this business. This app uses Supabase only for identity; booking data stays in the Sites D1 database.
2. Enable Email and Google in Supabase Auth. Configure Google OAuth credentials in the Supabase provider settings, with the callback URL shown by Supabase. Keep Google client secrets in Supabase.
3. Set the Supabase Site URL to APP_URL and allow `APP_URL/auth/complete` as a redirect URL. For local testing, allow `http://localhost:3000/auth/complete` too. Use exact URLs in production.
4. Configure production SMTP and verify the sender/domain. The default Supabase test sender is not a general-purpose production sender. Default email confirmation links use the PKCE code exchange; users should open the link in the same browser where they requested it.
5. Set AUTH_MODE=supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, APP_URL, and ADMIN_EMAILS. Deploy, then exercise both email and Google sign-in with two separate parent accounts and Maggie’s account.
6. Test sign-out, expired/reused links, account isolation, and both provider paths before enabling live bookings. No live provider test has been performed without your configuration.

References: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Google provider](https://supabase.com/docs/guides/auth/social-login/auth-google), [Email links](https://supabase.com/docs/guides/auth/auth-email-passwordless).

## Connect Square

Create a Square application and sandbox location. Supply the server token and location ID, then test invoice creation from a confirmed test booking, retries, payment, and status refresh. Use appropriate customer/order/invoice read-write permissions. Configure business details and accepted payment capabilities in Square. Switch token, location, and environment together for production. A parent email and booking amount are sent to Square when Maggie explicitly creates the invoice; card details are entered only on Square.

This app retrieves payment status on demand, not via webhook. Refunds and invoice cancellation happen in the Square dashboard. A interrupted invoice operation may require operator reconciliation if its database lock remains after a Worker termination; verify the Square invoice before clearing that lock. No real Square calls or transactions were made during development.

Reference: [Square Invoices API](https://developer.squareup.com/docs/invoices-api/overview).

## Local development and validation

Requires Node 22.13+ and npm. `npm ci`, then `npm run dev`. Apply the generated Drizzle migration to the local D1 binding before using the API. The generated Worker configuration after `npm run build` is `dist/server/wrangler.json`.

- `npx tsc --noEmit`
- `node --experimental-strip-types tests/domain.test.mjs` (Node 24 used in validation)
- `npm run build`
- `tests/worker-test-server.mjs` starts an isolated local Worker on 127.0.0.1:3001 using a fresh in-memory D1 database and applies the migration automatically. Then run `node tests/api.test.mjs`. Fixtures are synthetic and never published. The API suite expects a fresh test database.

The test server intentionally supplies review-mode bindings for isolated authentication tests. Never deploy it or use its synthetic accounts as production configuration. Its raw identity headers emulate the trusted Sites dispatcher. Production review-mode identity requires the Sites dispatcher to sanitize/verify those headers; on a direct Worker deployment use AUTH_MODE=supabase.

Validated: schema migration, daylight-saving conversions, rejected ambiguous/nonexistent times, concurrent booking exclusion, travel buffer conflict, authorization, cross-family read/write denial, status changes, original price preservation, cancellation release, missing-Square fail-closed, and origin checks. Live Supabase and Square tests remain pending credentials. Browser interaction testing was not requested. Optional WebMCP start_lesson_request is feature-detected; a supported WebMCP test context was unavailable, so its runtime registration is not claimed as verified.

## Deployment

The Sites project is recorded in `.openai/hosting.json`; keep that ID. Commit the validated source, build/package, save a version, and publish privately for review. Public access and custom-domain DNS must be configured deliberately at launch. Set APP_URL and provider redirect URLs to the actual chosen origin before public sign-in.

The initial application has no sample business data. Maggie signs in, adds lesson types and available times, reviews location details, then enables “Accept new lesson requests” in Settings.

## Data and operations

Only adults sign in. Collect a swimmer’s first name and minimal lesson notes. Do not put medical details in the form. Keep the site private until your business contact details, pool permissions, cancellation terms, and privacy notice are ready. Back up booking data and define an appropriate retention policy before launch.

Generated illustration: original AI-created artwork; it is not a photo of Maggie or her customers.

Dependency audit after security updates: no high/critical advisories; four moderate advisories remain in the Drizzle build-time esbuild loader chain. These development tools are not included in the deployed Worker. Do not expose their development servers to untrusted networks.

