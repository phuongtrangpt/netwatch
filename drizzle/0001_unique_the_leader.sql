CREATE TABLE `project_history` (
	`project_id` text NOT NULL,
	`minute` integer NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`project_id`, `minute`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`model` text NOT NULL,
	`mode` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `events` ADD `project_id` text DEFAULT 'main' NOT NULL;