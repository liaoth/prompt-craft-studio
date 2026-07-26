CREATE TABLE "prompt_favorite_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"favorite_id" uuid NOT NULL,
	"revision_no" integer NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"prompt_zh" text NOT NULL,
	"prompt_en" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(120) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prompt_favorites" ADD COLUMN "title" varchar(160) DEFAULT '未命名作品' NOT NULL;--> statement-breakpoint
ALTER TABLE "prompt_favorites" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "prompt_favorite_revisions" ADD CONSTRAINT "prompt_favorite_revisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_favorite_revisions" ADD CONSTRAINT "prompt_favorite_revisions_favorite_id_prompt_favorites_id_fk" FOREIGN KEY ("favorite_id") REFERENCES "public"."prompt_favorites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_folders" ADD CONSTRAINT "prompt_folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_favorite_revisions_number_uq" ON "prompt_favorite_revisions" USING btree ("favorite_id","revision_no");--> statement-breakpoint
CREATE INDEX "prompt_favorite_revisions_user_favorite_idx" ON "prompt_favorite_revisions" USING btree ("user_id","favorite_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_folders_user_name_uq" ON "prompt_folders" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "prompt_folders_user_sort_idx" ON "prompt_folders" USING btree ("user_id","sort_order");--> statement-breakpoint
ALTER TABLE "prompt_favorites" ADD CONSTRAINT "prompt_favorites_folder_id_prompt_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."prompt_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prompt_favorites_user_folder_idx" ON "prompt_favorites" USING btree ("user_id","folder_id");
--> statement-breakpoint
UPDATE "prompt_favorites"
SET "title" = left(
	coalesce(
		nullif(trim(regexp_replace("prompt_zh", '\s--[a-z].*$', '', 'i')), ''),
		nullif(trim(regexp_replace("prompt_en", '\s--[a-z].*$', '', 'i')), ''),
		'未命名作品'
	),
	160
);
--> statement-breakpoint
WITH converted AS (
	SELECT
		record."id",
		coalesce(
			(
				SELECT jsonb_agg(
					jsonb_build_object(
						'id', 'legacy-' || entry.key || '-' || record."id"::text,
						'field', entry.key,
						'order', 0,
						'textZh', entry.value,
						'textEn', coalesce(record."snapshot"->'translatedFields'->>entry.key, entry.value),
						'origin', 'legacy'
					)
					ORDER BY array_position(
						ARRAY['subject','action','environment','composition','camera','lighting','color','material','medium','style','mood','negative'],
						entry.key
					)
				)
				FROM jsonb_each_text(coalesce(record."snapshot"->'fields', record."snapshot"->'input', '{}'::jsonb)) entry
				WHERE entry.value <> ''
					AND entry.key = ANY(ARRAY['subject','action','environment','composition','camera','lighting','color','material','medium','style','mood','negative'])
			),
			'[]'::jsonb
		) AS blocks
	FROM "prompt_favorites" record
	WHERE coalesce((record."snapshot"->>'schemaVersion')::integer, 1) < 2
)
UPDATE "prompt_favorites" record
SET "snapshot" = jsonb_build_object(
	'schemaVersion', 2,
	'input', coalesce(record."snapshot"->'input', record."snapshot"->'fields', '{}'::jsonb),
	'variants', jsonb_build_array(jsonb_build_object(
		'id', 'detailed',
		'label', '详细',
		'blocks', converted.blocks,
		'bodyZh', trim(regexp_replace(record."prompt_zh", '\s--[a-z].*$', '', 'i')),
		'bodyEn', trim(regexp_replace(record."prompt_en", '\s--[a-z].*$', '', 'i')),
		'promptZh', record."prompt_zh",
		'promptEn', record."prompt_en"
	)),
	'selectedVariant', 'detailed',
	'blocks', converted.blocks,
	'targetSurface', 'web',
	'taskType', 'image',
	'bodyZh', trim(regexp_replace(record."prompt_zh", '\s--[a-z].*$', '', 'i')),
	'bodyEn', trim(regexp_replace(record."prompt_en", '\s--[a-z].*$', '', 'i')),
	'promptZh', record."prompt_zh",
	'promptEn', record."prompt_en",
	'fields', coalesce(record."snapshot"->'fields', record."snapshot"->'input', '{}'::jsonb),
	'translatedFields', coalesce(record."snapshot"->'translatedFields', '{}'::jsonb),
	'parameters', coalesce(record."snapshot"->'parameters', '{}'::jsonb),
	'warnings', coalesce(record."snapshot"->'warnings', '[]'::jsonb),
	'source', record."source"
)
FROM converted
WHERE record."id" = converted."id";
--> statement-breakpoint
WITH converted AS (
	SELECT
		record."id",
		coalesce(
			(
				SELECT jsonb_agg(
					jsonb_build_object(
						'id', 'legacy-' || entry.key || '-' || record."id"::text,
						'field', entry.key,
						'order', 0,
						'textZh', entry.value,
						'textEn', coalesce(record."snapshot"->'translatedFields'->>entry.key, entry.value),
						'origin', 'legacy'
					)
					ORDER BY array_position(
						ARRAY['subject','action','environment','composition','camera','lighting','color','material','medium','style','mood','negative'],
						entry.key
					)
				)
				FROM jsonb_each_text(coalesce(record."snapshot"->'fields', record."snapshot"->'input', '{}'::jsonb)) entry
				WHERE entry.value <> ''
					AND entry.key = ANY(ARRAY['subject','action','environment','composition','camera','lighting','color','material','medium','style','mood','negative'])
			),
			'[]'::jsonb
		) AS blocks
	FROM "prompt_histories" record
	WHERE coalesce((record."snapshot"->>'schemaVersion')::integer, 1) < 2
)
UPDATE "prompt_histories" record
SET "snapshot" = jsonb_build_object(
	'schemaVersion', 2,
	'input', coalesce(record."snapshot"->'input', record."snapshot"->'fields', '{}'::jsonb),
	'variants', jsonb_build_array(jsonb_build_object(
		'id', 'detailed',
		'label', '详细',
		'blocks', converted.blocks,
		'bodyZh', trim(regexp_replace(record."prompt_zh", '\s--[a-z].*$', '', 'i')),
		'bodyEn', trim(regexp_replace(record."prompt_en", '\s--[a-z].*$', '', 'i')),
		'promptZh', record."prompt_zh",
		'promptEn', record."prompt_en"
	)),
	'selectedVariant', 'detailed',
	'blocks', converted.blocks,
	'targetSurface', 'web',
	'taskType', 'image',
	'bodyZh', trim(regexp_replace(record."prompt_zh", '\s--[a-z].*$', '', 'i')),
	'bodyEn', trim(regexp_replace(record."prompt_en", '\s--[a-z].*$', '', 'i')),
	'promptZh', record."prompt_zh",
	'promptEn', record."prompt_en",
	'fields', coalesce(record."snapshot"->'fields', record."snapshot"->'input', '{}'::jsonb),
	'translatedFields', coalesce(record."snapshot"->'translatedFields', '{}'::jsonb),
	'parameters', coalesce(record."snapshot"->'parameters', '{}'::jsonb),
	'warnings', coalesce(record."snapshot"->'warnings', '[]'::jsonb),
	'source', record."source"
)
FROM converted
WHERE record."id" = converted."id";
--> statement-breakpoint
INSERT INTO "prompt_favorite_revisions" (
	"user_id",
	"favorite_id",
	"revision_no",
	"content_hash",
	"prompt_zh",
	"prompt_en",
	"snapshot",
	"created_at"
)
SELECT
	"user_id",
	"id",
	1,
	"content_hash",
	"prompt_zh",
	"prompt_en",
	"snapshot",
	"created_at"
FROM "prompt_favorites"
ON CONFLICT ("favorite_id", "revision_no") DO NOTHING;
