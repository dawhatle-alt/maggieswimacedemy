import type { createDatabase } from '../db/adapter';

type Database = ReturnType<typeof createDatabase>;
export type BookingEmail = {
 email: string; parent: string; swimmer: string; service_name: string;
 price: number; duration: number; start: string; location: string; address: string;
};
type Environment = { apiKey: string; from: string; appUrl: string };
type EmailRow = { id: string; kind: 'submitted'|'confirmed'; booking: BookingEmail; payload: string|null };
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

export function bookingEmail(b: BookingEmail, kind: 'submitted'|'confirmed', env: Environment) {
 const url = new URL('/?view=portal', env.appUrl);
 if(url.protocol !== 'https:') throw new Error('Invalid email portal URL');
 const confirmed = kind === 'confirmed';
 const title = confirmed ? 'Your swim lesson is confirmed!' : 'We received your swim lesson request';
 const message = confirmed
  ? 'Maggie has approved your lesson. We look forward to seeing your swimmer!'
  : 'Your request is awaiting Maggie’s approval. This email does not confirm your lesson. We’ll email you again when Maggie approves it.';
 const when = new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'long',month:'long',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(b.start));
 const rows = [['Swimmer',b.swimmer],['Lesson',b.service_name],['When',when+' (Central Time)'],['Duration',b.duration+' minutes'],['Location',b.location==='home'?'Your home pool':'Forest Creek community pool'],['Address',b.address],['Lesson price',new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(b.price/100)]];
 const payment = 'Payment is handled separately through Square. This email is not an invoice or payment receipt.';
 return {
  from:env.from, to:[b.email], subject: confirmed ? 'Maggie’s Swim Academy — lesson confirmed' : 'Maggie’s Swim Academy — request received',
  text:[title,'Hi '+b.parent+',',message,...rows.map(([k,v])=>k+': '+v),payment,'View your lesson: '+url.href,'Maggie’s Swim Academy'].join('\n\n'),
  html:`<!doctype html><html><body style="margin:0;background:#f0fbfa;font-family:Arial,sans-serif;color:#173c43"><div style="max-width:560px;margin:24px auto;padding:28px;background:white;border-radius:18px"><p style="color:#087f83;font-weight:bold">MAGGIE’S SWIM ACADEMY</p><h1 style="font-size:26px">${title}</h1><p>Hi ${escape(b.parent)},</p><p style="line-height:1.6">${message}</p><table style="width:100%;border-collapse:collapse">${rows.map(([k,v])=>`<tr><th style="text-align:left;vertical-align:top;padding:10px 10px 10px 0;border-bottom:1px solid #ddedeb">${k}</th><td style="padding:10px 0;border-bottom:1px solid #ddedeb">${escape(v)}</td></tr>`).join('')}</table><p style="margin:28px 0"><a href="${escape(url.href)}" style="background:#087f83;color:white;padding:14px 20px;border-radius:8px;text-decoration:none">View your lesson</a></p><p style="font-size:13px;line-height:1.5">${payment}</p></div></body></html>`
 };
}

export async function deliverBookingEmail(db: Database, id: string, env: Environment, send: typeof fetch = fetch) {
 // Superseded notifications should not invite a family to an already cancelled lesson.
 await db.prepare(`UPDATE booking_emails e SET state='skipped',error_code=NULL WHERE e.id=? AND e.state='pending' AND (e.locked_until IS NULL OR e.locked_until<now()) AND NOT EXISTS(SELECT 1 FROM bookings b WHERE b.id=e.booking_id AND ((e.kind='submitted' AND b.status='pending') OR (e.kind='confirmed' AND b.status='confirmed')))` ).bind(id).run();
 // Resend retains idempotency keys for 24 hours. Stop uncertain retries before
 // that boundary; an administrator must reconcile these in Resend.
 await db.prepare(`UPDATE booking_emails SET state='review',error_code='delivery_needs_review' WHERE id=? AND state='pending' AND first_attempt_at<now()-interval '23 hours' AND (locked_until IS NULL OR locked_until<now())`).bind(id).run();
 const row = await db.prepare("SELECT id,kind,booking,payload FROM booking_emails WHERE id=? AND state='pending'").bind(id).first<EmailRow>();
 if(!row) return 'unchanged';
 if(!env.apiKey || !env.from || !env.appUrl) {
  await db.prepare("UPDATE booking_emails SET error_code='email_not_configured' WHERE id=? AND state='pending'").bind(id).run();
  return 'pending';
 }
 // Persist the exact request body once so a retry always reuses the same payload.
 const payload = row.payload || JSON.stringify(bookingEmail(row.booking,row.kind,env));
 const claim = await db.prepare(`UPDATE booking_emails SET payload=coalesce(payload,?),locked_until=now()+interval '2 minutes',first_attempt_at=coalesce(first_attempt_at,now()) WHERE id=? AND state='pending' AND (locked_until IS NULL OR locked_until<now()) AND (first_attempt_at IS NULL OR first_attempt_at>now()-interval '23 hours') RETURNING payload`).bind(payload,id).first<{payload:string}>();
 if(!claim) return 'unchanged';
 try {
  const response = await send('https://api.resend.com/emails',{
   method:'POST',headers:{Authorization:'Bearer '+env.apiKey,'Content-Type':'application/json','Idempotency-Key':'maggie-booking/'+id},
   body:claim.payload,signal:AbortSignal.timeout(8000)
  });
  if(!response.ok) throw Object.assign(new Error('Email provider rejected request'),{code:'resend_http_'+response.status});
  const result = await response.json() as {id?:string};
  if(!result.id) throw Object.assign(new Error('Invalid email response'),{code:'resend_invalid_response'});
  await db.prepare("UPDATE booking_emails SET state='sent',sent_at=now(),provider_id=?,error_code=NULL,locked_until=NULL WHERE id=?").bind(result.id,id).run();
  return 'sent';
 } catch(error) {
  const code=(error as {code?:string}).code || 'email_delivery_uncertain';
  await db.prepare("UPDATE booking_emails SET error_code=?,locked_until=NULL WHERE id=? AND state='pending'").bind(/^resend_(http_\d{3}|invalid_response)$/.test(code)?code:'email_delivery_uncertain',id).run();
  return 'pending';
 }
}
