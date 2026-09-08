import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from 'cloudflare:workers';
export function authEnv(key: string) {
  return String((env as unknown as Record<string, unknown>)[key] || '');
}
export function authReady() {
  return !!authEnv('SUPABASE_URL') && !!authEnv('SUPABASE_PUBLISHABLE_KEY');
}
export async function authClient() {
  if (!authReady())
    throw Object.assign(
      new Error('Email and Google sign-in are not connected yet.'),
      { status: 503 },
    );
  const jar = await cookies();
  return createServerClient(
    authEnv('SUPABASE_URL'),
    authEnv('SUPABASE_PUBLISHABLE_KEY'),
    {
      cookieOptions: {
        sameSite: 'lax',
        httpOnly: true,
        secure: authEnv('APP_URL').startsWith('https://'),
        path: '/',
      },
      cookies: {
        getAll() {
          return jar.getAll();
        },
        setAll(values) {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        },
      },
    },
  );
}
