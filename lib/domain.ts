export const DEFAULT_SETTINGS = {
  poolName: 'Forest Creek community pool',
  poolAddress: 'Forest Creek, Round Rock, TX',
  homeArea: 'Round Rock area',
  bufferMinutes: 15,
  open: false,
};
export const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    cents / 100,
  );
export const displayDate = (s: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(s));
export const displayTime = (s: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(s));
export function centralToUtc(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error('Choose a valid date and time.');
  const guess = new Date(value + 'Z').getTime();
  if (!Number.isFinite(guess)) throw new Error('Invalid date.');
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const matches = [5, 6]
    .map((h) => new Date(guess + h * 3600000))
    .filter((d) => formatter.format(d).replace(' ', 'T') === value);
  if (matches.length !== 1)
    throw new Error(
      'This time falls in a daylight-saving clock change. Choose another time.',
    );
  return matches[0].toISOString();
}
export function transitionAllowed(
  from: string,
  to: string,
  hasInvoice: boolean,
  invoiceStatus?: string | null,
) {
  if (hasInvoice && to === 'cancelled' && invoiceStatus !== 'CANCELED')
    return false;
  return (
    (
      {
        pending: ['confirmed', 'declined', 'cancelled'],
        confirmed: ['completed', 'cancelled'],
      } as Record<string, string[]>
    )[from]?.includes(to) ?? false
  );
}
