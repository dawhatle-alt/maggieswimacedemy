import { authClient, authEnv } from '@/lib/auth';
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code');
  const origin = authEnv('APP_URL');
  if (!origin)
    return new Response('Sign-in is not configured.', { status: 503 });
  if (code) {
    try {
      const client = await authClient();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return Response.redirect(origin + '/?view=portal', 303);
    } catch {}
  }
  return Response.redirect(origin + '/?view=portal&authError=1', 303);
}
