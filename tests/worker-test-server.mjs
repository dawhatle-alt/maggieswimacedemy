import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { resolve } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';
const root = resolve('dist/server');
const paths = readdirSync(root, { recursive: true }).filter((p) =>
  p.endsWith('.js'),
);
const modules = ['index.js', ...paths.filter((p) => p !== 'index.js')].map(
  (p) => ({ type: 'ESModule', path: resolve(root, p) }),
);
const mf = new Miniflare(convertV4MiniflareOptions({
  modules,
  modulesRoot: root,
  compatibilityDate: '2026-05-15',
  compatibilityFlags: ['nodejs_compat'],
  d1Databases: { DB: '00000000-0000-4000-8000-000000000000' },
  d1Persist: false,
  bindings: { AUTH_MODE: 'review', ADMIN_EMAILS: 'admin@example.test' },
  port: 3001,
  host: '127.0.0.1',
}));
await mf.ready;
const db=await mf.getD1Database('DB');
await db.batch(readFileSync('drizzle/0000_minor_fenris.sql','utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
console.log(String(await mf.ready));


