import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("rooms", {
  code: text("code").primaryKey(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("rooms_expiry_idx").on(table.expiresAt)]);

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  roomCode: text("room_code").notNull().references(() => rooms.code, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  name: text("name").notNull(),
  outfit: text("outfit").notNull(),
  x: real("x").notNull().default(0),
  y: real("y").notNull().default(0),
  z: real("z").notNull().default(0),
  angle: real("angle").notNull().default(0),
  score: integer("score").notNull().default(0),
  lastSeen: integer("last_seen").notNull(),
}, (table) => [index("players_room_presence_idx").on(table.roomCode, table.lastSeen)]);
