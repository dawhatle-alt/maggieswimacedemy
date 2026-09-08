
import { authClient, authReady } from './auth';

import { database } from '@/db';
import { DEFAULT_SETTINGS } from './domain';
export function settingEnv(key: string) {
  return process.env[key] || '';
}
export async function identity() {
  let u: {
    userId: string;
    email: string;
    fullName: string | null;
    displayName: string;
  } | null = null;
  if (authReady()) {
    const client = await authClient();
    const { data, error } = await client.auth.getUser();
    if (!error && data.user?.email && data.user.email_confirmed_at) {
      u = {
        userId: 'sb:' + data.user.id,
        email: data.user.email,
        fullName: null,
        displayName: data.user.email,
      };
    }
  }
  if (!u) return null;
  return {
    ...u,
    isAdmin: settingEnv('ADMIN_EMAILS')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .includes(u.email.toLowerCase()),
  };
}
export async function config() {
  const row = await database()
    .prepare('SELECT data FROM settings WHERE id=1')
    .first<{ data: string }>();
  return { ...DEFAULT_SETTINGS, ...(row ? JSON.parse(row.data) : {}) };
}
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
export function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
export function str(v: unknown, name: string, max = 200, optional = false) {
  if (typeof v !== 'string' || (!optional && !v.trim()) || v.length > max)
    fail('Please enter a valid ' + name + '.');
  return v.trim();
}
export function num(v: unknown, name: string, min: number, max: number) {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)
    fail('Please enter a valid ' + name + '.');
  return v;
}
export async function body(req: Request) {
  if (!req.headers.get('content-type')?.startsWith('application/json'))
    fail('Expected JSON.', 415);
  const origin = req.headers.get('origin');
  if (!origin || origin !== new URL(req.url).origin)
    fail('Request origin was not accepted.', 403);
  const text = await req.text();
  if (text.length > 16000) fail('Request is too large.', 413);
  try {
    return JSON.parse(text);
  } catch {
    fail('Invalid request.');
  }
}
export async function api(run: () => Promise<Response>) {
  try {
    return await run();
  } catch (e) {
    const err = e as Error & { status?: number; code?: string };
    if (err.code === '23505' || err.message.includes('UNIQUE constraint'))
      return json(
        { error: 'This time has just been requested. Please choose another.' },
        409,
      );
    if (err.code === '23P01' || err.code === 'P0001') return json({error:'This time is no longer available or overlaps an existing lesson.'},409);
    console.error('Booking API:', err.code || err.name);
    return json(
      {
        error: err.status
          ? err.message
          : 'Something went wrong. Please try again.',
      },
      err.status || 500,
    );
  }
}
export async function requireUser() {
  const u = await identity();
  if (!u) fail('Please sign in to continue.', 401);
  return u;
}
export async function requireAdmin() {
  const u = await requireUser();
  if (!u.isAdmin)
    fail('Only Maggie’s authorized account can manage lessons.', 403);
  return u;
}

