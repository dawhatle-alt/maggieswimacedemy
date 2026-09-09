import { database } from '@/db';
import { deliverBookingEmail } from './email-core';

export async function notifyBooking(id: string, kind: 'submitted'|'confirmed') {
 try {
  return await deliverBookingEmail(database(),id+':'+kind,{
   apiKey:process.env.RESEND_API_KEY || '',from:process.env.BOOKING_EMAIL_FROM || '',appUrl:process.env.APP_URL || ''
  });
 } catch {
  // A saved booking remains successful even if email delivery/storage is interrupted.
  console.error('Booking email: delivery_pending');
  return 'pending';
 }
}
