import { env } from 'cloudflare:workers';
export function database() {
  if (!env.DB)
    throw new Error('Booking storage is unavailable. Please try again later.');
  return env.DB;
}
