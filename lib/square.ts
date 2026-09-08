import { settingEnv, fail } from './server';
export async function square(path: string, payload?: unknown) {
  const token = settingEnv('SQUARE_ACCESS_TOKEN');
  if (!token || !settingEnv('SQUARE_LOCATION_ID'))
    fail(
      'Square is not connected yet. Add the Square account connection before creating invoices.',
      503,
    );
  const base =
    settingEnv('SQUARE_ENVIRONMENT') === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';
  const response = await fetch(base + '/v2' + path, {
    method: payload ? 'POST' : 'GET',
    headers: {
      Authorization: 'Bearer ' + token,
      'Square-Version': '2026-08-19',
      'Content-Type': 'application/json',
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await response.json()) as any;
  if (!response.ok)
    fail(
      'Square could not complete this action. Check the Square account connection and invoice in Square, then retry.',
      502,
    );
  return data;
}
