import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  data: text('data').notNull(),
});
export const services = sqliteTable('services', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  duration: integer('duration').notNull(),
  price: integer('price').notNull(),
  active: integer('active').notNull().default(1),
});
export const slots = sqliteTable(
  'slots',
  {
    id: text('id').primaryKey(),
    serviceId: text('service_id')
      .notNull()
      .references(() => services.id),
    start: text('start').notNull(),
    end: text('end').notNull(),
    blockedUntil: text('blocked_until').notNull(),
    location: text('location').notNull(),
    active: integer('active').notNull().default(1),
  },
  (t) => [index('idx_slots_start').on(t.start)],
);
export const bookings = sqliteTable(
  'bookings',
  {
    id: text('id').primaryKey(),
    slotId: text('slot_id')
      .notNull()
      .references(() => slots.id),
    userId: text('user_id').notNull(),
    email: text('email').notNull(),
    parent: text('parent').notNull(),
    swimmer: text('swimmer').notNull(),
    phone: text('phone').notNull(),
    location: text('location').notNull(),
    address: text('address').notNull(),
    notes: text('notes').notNull(),
    status: text('status').notNull().default('pending'),
    serviceName: text('service_name').notNull(),
    price: integer('price').notNull(),
    duration: integer('duration').notNull(),
    start: text('start').notNull(),
    end: text('end').notNull(),
    created: text('created').notNull(),
    invoiceId: text('invoice_id'),
    invoiceUrl: text('invoice_url'),
    invoiceStatus: text('invoice_status'),
    invoiceLock: text('invoice_lock'),
  },
  (t) => [
    index('idx_bookings_user_start').on(t.userId, t.start),
    index('idx_bookings_status').on(t.status),
    uniqueIndex('idx_bookings_active_slot')
      .on(t.slotId)
      .where(sql`${t.status} in ('pending','confirmed','completed')`),
  ],
);
