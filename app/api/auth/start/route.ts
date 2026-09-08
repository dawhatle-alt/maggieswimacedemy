import { api, json, body, str, fail } from '@/lib/server';
import { authClient, authEnv } from '@/lib/auth';
export async function POST(req: Request) {
  return api(async () => {
    const p = await body(req);
    const origin = authEnv('APP_URL');
    if (!origin || new URL(origin).origin !== new URL(req.url).origin)
      fail('The sign-in address is not configured for this site.', 503);
    const client = await authClient();
    const redirectTo = origin.replace(/\/$/, '') + '/auth/complete';
    if (p.provider === 'google') {
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url)
        fail('Google sign-in could not start. Please try again.', 502);
      return json({ url: data.url });
    }
    if (p.provider !== 'email') fail('Choose email or Google.');
    const email = str(p.email, 'email', 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail('Enter a valid email address.');
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error)
      fail(
        'Unable to send a sign-in link. Please wait a minute and try again.',
        429,
      );
    return json({ ok: true });
  });
}
