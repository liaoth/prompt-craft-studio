CREATE TABLE `ai_provider_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`provider` text NOT NULL,
	`endpoint` text NOT NULL,
	`model` text NOT NULL,
	`credential_encrypted` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_provider_configs_user_idx` ON `ai_provider_configs` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_provider_configs_one_active_uq` ON `ai_provider_configs` (`user_id`) WHERE "ai_provider_configs"."is_active" = 1;--> statement-breakpoint
CREATE TABLE `midjourney_provider_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`provider` text NOT NULL,
	`endpoint` text NOT NULL,
	`credential_encrypted` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `midjourney_provider_configs_user_idx` ON `midjourney_provider_configs` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `midjourney_provider_configs_one_active_uq` ON `midjourney_provider_configs` (`user_id`) WHERE "midjourney_provider_configs"."is_active" = 1;--> statement-breakpoint
CREATE TABLE `midjourney_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider_config_id` text,
	`content_hash` text NOT NULL,
	`prompt_zh` text NOT NULL,
	`prompt_en` text NOT NULL,
	`status` text NOT NULL,
	`error_message` text,
	`provider_response` text,
	`source` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`provider_config_id`) REFERENCES `midjourney_provider_configs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `midjourney_submissions_user_idx` ON `midjourney_submissions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `midjourney_submissions_user_hash_uq` ON `midjourney_submissions` (`user_id`,`content_hash`);--> statement-breakpoint
CREATE INDEX `midjourney_submissions_updated_idx` ON `midjourney_submissions` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `phrase_snippets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT '未分类' NOT NULL,
	`content` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `phrase_snippets_user_sort_idx` ON `phrase_snippets` (`user_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `prompt_favorite_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`favorite_id` text NOT NULL,
	`revision_no` integer NOT NULL,
	`content_hash` text NOT NULL,
	`prompt_zh` text NOT NULL,
	`prompt_en` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`favorite_id`) REFERENCES `prompt_favorites`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_favorite_revisions_number_uq` ON `prompt_favorite_revisions` (`favorite_id`,`revision_no`);--> statement-breakpoint
CREATE INDEX `prompt_favorite_revisions_user_favorite_idx` ON `prompt_favorite_revisions` (`user_id`,`favorite_id`);--> statement-breakpoint
CREATE TABLE `prompt_favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`content_hash` text NOT NULL,
	`prompt_zh` text NOT NULL,
	`prompt_en` text NOT NULL,
	`source` text NOT NULL,
	`title` text DEFAULT '未命名作品' NOT NULL,
	`folder_id` text,
	`note` text DEFAULT '' NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folder_id`) REFERENCES `prompt_folders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_favorites_user_hash_uq` ON `prompt_favorites` (`user_id`,`content_hash`);--> statement-breakpoint
CREATE INDEX `prompt_favorites_user_updated_idx` ON `prompt_favorites` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `prompt_favorites_user_folder_idx` ON `prompt_favorites` (`user_id`,`folder_id`);--> statement-breakpoint
CREATE TABLE `prompt_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_folders_user_name_uq` ON `prompt_folders` (`user_id`,`name`);--> statement-breakpoint
CREATE INDEX `prompt_folders_user_sort_idx` ON `prompt_folders` (`user_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `prompt_histories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`content_hash` text NOT NULL,
	`prompt_zh` text NOT NULL,
	`prompt_en` text NOT NULL,
	`source` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_histories_user_hash_uq` ON `prompt_histories` (`user_id`,`content_hash`);--> statement-breakpoint
CREATE INDEX `prompt_histories_user_updated_idx` ON `prompt_histories` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `translation_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`provider` text NOT NULL,
	`endpoint` text NOT NULL,
	`credential_encrypted` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `translation_configs_user_idx` ON `translation_configs` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `translation_configs_one_active_uq` ON `translation_configs` (`user_id`) WHERE "translation_configs"."is_active" = 1;--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
INSERT INTO `users` (`id`, `name`, `email`)
VALUES ('local-workspace', 'Local Workspace', 'local@prompt-craft.invalid');
