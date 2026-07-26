import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

// Better Auth core tables. Keep these export names singular because the
// Better Auth Drizzle adapter resolves models by export key.
export const user = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  ...timestamps,
});

export const session = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const phraseSnippets = pgTable(
  "phrase_snippets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    category: varchar("category", { length: 50 }).default("未分类").notNull(),
    content: varchar("content", { length: 500 }).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    index("phrase_snippets_user_sort_idx").on(table.userId, table.sortOrder),
  ],
);

export const promptHistories = pgTable(
  "prompt_histories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    promptZh: text("prompt_zh").notNull(),
    promptEn: text("prompt_en").notNull(),
    source: varchar("source", { length: 16 }).notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
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

export const promptFolders = pgTable(
  "prompt_folders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("prompt_folders_user_name_uq").on(table.userId, table.name),
    index("prompt_folders_user_sort_idx").on(table.userId, table.sortOrder),
  ],
);

export const promptFavorites = pgTable(
  "prompt_favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    promptZh: text("prompt_zh").notNull(),
    promptEn: text("prompt_en").notNull(),
    source: varchar("source", { length: 16 }).notNull(),
    title: varchar("title", { length: 160 }).default("未命名作品").notNull(),
    folderId: uuid("folder_id").references(() => promptFolders.id, {
      onDelete: "set null",
    }),
    note: varchar("note", { length: 1000 }).default("").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
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

export const promptFavoriteRevisions = pgTable(
  "prompt_favorite_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    favoriteId: uuid("favorite_id")
      .notNull()
      .references(() => promptFavorites.id, { onDelete: "cascade" }),
    revisionNo: integer("revision_no").notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    promptZh: text("prompt_zh").notNull(),
    promptEn: text("prompt_en").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
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

export const aiProviderConfigs = pgTable(
  "ai_provider_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 80 }).notNull(),
    provider: varchar("provider", { length: 32 }).notNull(),
    endpoint: varchar("endpoint", { length: 2048 }).notNull(),
    model: varchar("model", { length: 120 }).notNull(),
    credentialEncrypted: text("credential_encrypted").notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    index("ai_provider_configs_user_idx").on(table.userId),
    uniqueIndex("ai_provider_configs_one_active_uq")
      .on(table.userId)
      .where(sql`${table.isActive} = true`),
  ],
);

export const translationConfigs = pgTable(
  "translation_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 80 }).notNull(),
    provider: varchar("provider", { length: 32 }).notNull(),
    endpoint: varchar("endpoint", { length: 2048 }).notNull(),
    credentialEncrypted: text("credential_encrypted").notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    index("translation_configs_user_idx").on(table.userId),
    uniqueIndex("translation_configs_one_active_uq")
      .on(table.userId)
      .where(sql`${table.isActive} = true`),
  ],
);

export const midjourneyProviderConfigs = pgTable(
  "midjourney_provider_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 80 }).notNull(),
    provider: varchar("provider", { length: 32 }).notNull(),
    endpoint: varchar("endpoint", { length: 2048 }).notNull(),
    credentialEncrypted: text("credential_encrypted").notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    index("midjourney_provider_configs_user_idx").on(table.userId),
    uniqueIndex("midjourney_provider_configs_one_active_uq")
      .on(table.userId)
      .where(sql`${table.isActive} = true`),
  ],
);

export const midjourneySubmissions = pgTable(
  "midjourney_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    providerConfigId: uuid("provider_config_id")
      .references(() => midjourneyProviderConfigs.id, {
        onDelete: "set null",
      }),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    promptZh: text("prompt_zh").notNull(),
    promptEn: text("prompt_en").notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    errorMessage: text("error_message"),
    providerResponse: jsonb("provider_response").$type<
      Record<string, unknown>
    >(),
    source: varchar("source", { length: 16 }).notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
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
  sessions: many(session),
  accounts: many(account),
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

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));
