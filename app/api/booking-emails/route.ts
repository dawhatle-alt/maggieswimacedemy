import {api,json,requireAdmin,body} from '@/lib/server';
import {database} from '@/db';
import {notifyBooking} from '@/lib/booking-emails';
export const maxDuration=60;
export async function POST(req:Request){return api(async()=>{
 await requireAdmin(); await body(req);
 const pending=await database().prepare("SELECT booking_id,kind FROM booking_emails WHERE state='pending' AND (locked_until IS NULL OR locked_until<now()) ORDER BY created LIMIT 3").all();
 let sent=0;
 for(const row of pending.results){
  if(await notifyBooking(row.booking_id as string,row.kind as 'submitted'|'confirmed')==='sent')sent++;
 }
 return json({sent});
});}
