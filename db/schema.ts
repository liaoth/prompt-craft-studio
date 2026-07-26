import { randomUUID } from "node:crypto";

import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const LOCAL_USER_ID = "local-workspace";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdate(() => new Date())
    .notNull(),
};

const uuid = (name: string) =>
  text(name)
    .primaryKey()
    .$defaultFn(() => randomUUID());

export const user = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  ...timestamps,
});

export const phraseSnippets = sqliteTable(
  "phrase_snippets",
  {
    id: uuid("id"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").default("未分类").notNull(),
    content: text("content").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    index("phrase_snippets_user_sort_idx").on(table.userId, table.sortOrder),
  ],
);

export const promptHistories = sqliteTable(
  "prompt_histories",
  {
    id: uuid("id"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    contentHash: text("content_hash").notNull(),
    promptZh: text("prompt_zh").notNull(),
    promptEn: text("prompt_en").notNull(),
    source: text("source").notNull(),
    snapshot: text("snapshot", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("prompt_histories_user_hash_uq").on(
      table.userId,
      table.contentHash,
    ),
    index("prompt_histories_user_updated_idx").on(
      table.userId,
      table.updatedAt,
    ),
  ],
);

export const promptFolders = sqliteTable(
  "prompt_folders",
  {
    id: uuid("id"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("prompt_folders_user_name_uq").on(table.userId, table.name),
    index("prompt_folders_user_sort_idx").on(table.userId, table.sortOrder),
  ],
);

export const promptFavorites = sqliteTable(
  "prompt_favorites",
  {
    id: uuid("id"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    contentHash: text("content_hash").notNull(),
    promptZh: text("prompt_zh").notNull(),
    promptEn: text("prompt_en").notNull(),
    source: text("source").notNull(),
    title: text("title").default("未命名作品").notNull(),
    folderId: text("folder_id").references(() => promptFolders.id, {
      onDelete: "set null",
    }),
    note: text("note").default("").notNull(),
    snapshot: text("snapshot", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("prompt_favorites_user_hash_uq").on(
      table.userId,
      table.contentHash,
    ),
    index("prompt_favorites_user_updated_idx").on(
      table.userId,
      table.updatedAt,
    ),
    index("prompt_favorites_user_folder_idx").on(table.userId, table.folderId),
  ],
);

export const promptFavoriteRevisions = sqliteTable(
  "prompt_favorite_revisions",
  {
    id: uuid("id"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    favoriteId: text("favorite_id")
      .notNull()
      .references(() => promptFavorites.id, { onDelete: "cascade" }),
    revisionNo: integer("revision_no").notNull(),
    contentHash: text("content_hash").notNull(),
    promptZh: text("prompt_zh").notNull(),
    promptEn: text("prompt_en").notNull(),
    snapshot: text("snapshot", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(unixepoch() * 1000)`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("prompt_favorite_revisions_number_uq").on(
      table.favoriteId,
      table.revisionNo,
    ),
    index("prompt_favorite_revisions_user_favorite_idx").on(
      table.userId,
      table.favoriteId,
    ),
  ],
);

export const aiProviderConfigs = sqliteTable(
  "ai_provider_configs",
  {
    id: uuid("id"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    provider: text("provider").notNull(),
    endpoint: text("endpoint").notNull(),
    model: text("model").notNull(),
    credentialEncrypted: text("credential_encrypted").notNull(),
    isActive: integer("is_active", { mode: "boolean" })
      .default(false)
      .notNull(),
    ...timestamps,
  },
  (table) => [
    index("ai_provider_configs_user_idx").on(table.userId),
    uniqueIndex("ai_provider_configs_one_active_uq")
      .on(table.userId)
      .where(sql`${table.isActive} = 1`),
  ],
);

export const translationConfigs = sqliteTable(
  "translation_configs",
  {
    id: uuid("id"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    provider: text("provider").notNull(),
    endpoint: text("endpoint").notNull(),
    credentialEncrypted: text("credential_encrypted").notNull(),
    isActive: integer("is_active", { mode: "boolean" })
      .default(false)
      .notNull(),
    ...timestamps,
  },
  (table) => [
    index("translation_configs_user_idx").on(table.userId),
    uniqueIndex("translation_configs_one_active_uq")
      .on(table.userId)
      .where(sql`${table.isActive} = 1`),
  ],
);

export const midjourneyProviderConfigs = sqliteTable(
  "midjourney_provider_configs",
  {
    id: uuid("id"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    provider: text("provider").notNull(),
    endpoint: text("endpoint").notNull(),
    credentialEncrypted: text("credential_encrypted").notNull(),
    isActive: integer("is_active", { mode: "boolean" })
      .default(false)
      .notNull(),
    ...timestamps,
  },
  (table) => [
    index("midjourney_provider_configs_user_idx").on(table.userId),
    uniqueIndex("midjourney_provider_configs_one_active_uq")
      .on(table.userId)
      .where(sql`${table.isActive} = 1`),
  ],
);

export const midjourneySubmissions = sqliteTable(
  "midjourney_submissions",
  {
    id: uuid("id"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    providerConfigId: text("provider_config_id").references(
      () => midjourneyProviderConfigs.id,
      { onDelete: "set null" },
    ),
    contentHash: text("content_hash").notNull(),
    promptZh: text("prompt_zh").notNull(),
    promptEn: text("prompt_en").notNull(),
    status: text("status").notNull(),
    errorMessage: text("error_message"),
    providerResponse: text("provider_response", { mode: "json" }).$type<
      Record<string, unknown>
    >(),
    source: text("source").notNull(),
    snapshot: text("snapshot", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    index("midjourney_submissions_user_idx").on(table.userId),
    uniqueIndex("midjourney_submissions_user_hash_uq").on(
      table.userId,
      table.contentHash,
    ),
    index("midjourney_submissions_updated_idx").on(
      table.userId,
      table.updatedAt,
    ),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  phrases: many(phraseSnippets),
  histories: many(promptHistories),
  folders: many(promptFolders),
  favorites: many(promptFavorites),
  favoriteRevisions: many(promptFavoriteRevisions),
  aiProviderConfigs: many(aiProviderConfigs),
  translationConfigs: many(translationConfigs),
  midjourneyProviderConfigs: many(midjourneyProviderConfigs),
  midjourneySubmissions: many(midjourneySubmissions),
}));
