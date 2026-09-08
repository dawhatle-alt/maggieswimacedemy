import { authReady } from '@/lib/auth';
import { api, json, identity, config, settingEnv } from '@/lib/server';
import { database } from '@/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  return api(async () => {
    const user = await identity();
    const settings = await config();
    const services = (
      await database()
        .prepare('SELECT * FROM services WHERE active=1 ORDER BY price,name')
        .all()
    ).results;
    return json({
      user,
      settings,
      services,
      squareReady:
        !!settingEnv('SQUARE_ACCESS_TOKEN') &&
        !!settingEnv('SQUARE_LOCATION_ID'),
      adminConfigured: !!settingEnv('ADMIN_EMAILS'),
      authMode: settingEnv('AUTH_MODE') || 'supabase',
      authReady: authReady(),
    });
  });
}
