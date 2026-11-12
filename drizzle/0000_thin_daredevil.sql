CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`at` integer NOT NULL,
	`level` text NOT NULL,
	`message` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `history` (
	`minute` integer PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `router` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`paired_at` integer NOT NULL,
	`last_seen` integer,
	`metrics` text,
	`previous` text,
	`previous_at` integer
);
--> statement-breakpoint
CREATE TABLE `section_chunks` (
	`name` text NOT NULL,
	`generation` text NOT NULL,
	`part` integer NOT NULL,
	`data` text NOT NULL,
	`received_at` integer NOT NULL,
	PRIMARY KEY(`name`, `generation`, `part`)
);
--> statement-breakpoint
CREATE TABLE `section_heads` (
	`name` text PRIMARY KEY NOT NULL,
	`generation` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
