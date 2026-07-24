CREATE TABLE "midjourney_provider_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"label" varchar(80) NOT NULL,
	"provider" varchar(32) NOT NULL,
	"endpoint" varchar(500) NOT NULL,
	"credential_encrypted" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "midjourney_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider_config_id" uuid,
	"content_hash" varchar(64) NOT NULL,
	"prompt_zh" text NOT NULL,
	"prompt_en" text NOT NULL,
	"status" varchar(16) NOT NULL,
	"error_message" text,
	"provider_response" jsonb,
	"source" varchar(16) NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "midjourney_provider_configs" ADD CONSTRAINT "midjourney_provider_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "midjourney_submissions" ADD CONSTRAINT "midjourney_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "midjourney_submissions" ADD CONSTRAINT "midjourney_submissions_provider_config_id_midjourney_provider_configs_id_fk" FOREIGN KEY ("provider_config_id") REFERENCES "public"."midjourney_provider_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "midjourney_provider_configs_user_idx" ON "midjourney_provider_configs" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "midjourney_provider_configs_one_active_uq" ON "midjourney_provider_configs" USING btree ("user_id") WHERE "midjourney_provider_configs"."is_active" = true;--> statement-breakpoint
CREATE INDEX "midjourney_submissions_user_idx" ON "midjourney_submissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "midjourney_submissions_updated_idx" ON "midjourney_submissions" USING btree ("user_id","updated_at");