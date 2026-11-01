import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const standards = sqliteTable("standards", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
  revision: integer("revision").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const sharedReports = sqliteTable("shared_reports", {
  token: text("token").primaryKey(),
  objectKey: text("object_key").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
