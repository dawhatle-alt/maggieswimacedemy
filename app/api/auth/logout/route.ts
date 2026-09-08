import { api, json, body } from '@/lib/server';
import { authClient } from '@/lib/auth';
export async function POST(req: Request) {
  return api(async () => {
    await body(req);
    const client = await authClient();
    await client.auth.signOut({ scope: 'local' });
    return json({ ok: true });
  });
}
