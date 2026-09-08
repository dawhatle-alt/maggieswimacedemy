CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`slot_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`parent` text NOT NULL,
	`swimmer` text NOT NULL,
	`phone` text NOT NULL,
	`location` text NOT NULL,
	`address` text NOT NULL,
	`notes` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`service_name` text NOT NULL,
	`price` integer NOT NULL,
	`duration` integer NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`created` text NOT NULL,
	`invoice_id` text,
	`invoice_url` text,
	`invoice_status` text,
	`invoice_lock` text,
	FOREIGN KEY (`slot_id`) REFERENCES `slots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_bookings_user_start` ON `bookings` (`user_id`,`start`);--> statement-breakpoint
CREATE INDEX `idx_bookings_status` ON `bookings` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bookings_active_slot` ON `bookings` (`slot_id`) WHERE "bookings"."status" in ('pending','confirmed','completed');--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`duration` integer NOT NULL,
	`price` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `slots` (
	`id` text PRIMARY KEY NOT NULL,
	`service_id` text NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`blocked_until` text NOT NULL,
	`location` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_slots_start` ON `slots` (`start`);