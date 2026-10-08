/**
 * The Games4James database (Supabase Postgres, plan T6.2). Drizzle owns the
 * schema: change it here, run `npm run db:generate -w apps/backend-api`, commit
 * the SQL in drizzle/. Times are timestamptz; ids are Firebase uids (users) or
 * manifest ids (games).
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const accountType = pgEnum("account_type", ["anonymous", "username_pin", "linked"]);
export const gameStatus = pgEnum("game_status", ["active", "beta", "inactive"]);
export const followStatus = pgEnum("follow_status", ["pending", "accepted"]);

export const users = pgTable(
  "users",
  {
    /** Firebase uid. */
    id: text("id").primaryKey(),
    /** Login name for username+PIN accounts (never shown publicly). */
    username: text("username"),
    /** Public name on leaderboards; generated, then editable by the kid (T6.7). */
    screenName: text("screen_name").notNull(),
    screenNameSetByUser: boolean("screen_name_set_by_user").notNull().default(false),
    avatar: integer("avatar").notNull().default(1),
    accountType: accountType("account_type").notNull().default("anonymous"),
    pinHash: text("pin_hash"),
    email: text("email"),
    emailVerified: boolean("email_verified").notNull().default(false),
    admin: boolean("admin").notNull().default(false),
    betaTester: boolean("beta_tester").notNull().default(false),
    xpTotal: integer("xp_total").notNull().default(0),
    xpLevel: integer("xp_level").notNull().default(1),
    /** XP banked towards the next level. */
    xpProgress: integer("xp_progress").notNull().default(0),
    streakCurrent: integer("streak_current").notNull().default(0),
    streakLongest: integer("streak_longest").notNull().default(0),
    /** The player's local calendar day of their last check-in (YYYY-MM-DD). */
    streakLastDay: date("streak_last_day", { mode: "string" }),
    prefs: jsonb("prefs").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("users_username_lower_key").on(sql`lower(${t.username})`),
    uniqueIndex("users_screen_name_lower_key").on(sql`lower(${t.screenName})`),
  ],
);

export const games = pgTable("games", {
  /** Manifest id (folder name). Seeded from the exported manifests on every deploy. */
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: gameStatus("status").notNull().default("active"),
  xpMultiplier: real("xp_multiplier").notNull().default(1),
  maxScore: integer("max_score").notNull(),
  maxScorePerSecond: integer("max_score_per_second").notNull(),
  /** Admin-managed extras (campaign badges, promo text). */
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const plays = pgTable(
  "plays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Null after the player deletes their account (T7.8): scores stay, anonymised. */
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id),
    score: integer("score").notNull(),
    durationMs: integer("duration_ms"),
    xpAwarded: integer("xp_awarded").notNull().default(0),
    remixId: uuid("remix_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("plays_game_score_idx").on(t.gameId, t.score.desc()),
    index("plays_user_created_idx").on(t.userId, t.createdAt.desc()),
  ],
);

/** One row per (player, game): the leaderboards read only this. */
export const bestScores = pgTable(
  "best_scores",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id),
    score: integer("score").notNull(),
    playId: uuid("play_id").references(() => plays.id, { onDelete: "set null" }),
    achievedAt: timestamp("achieved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.gameId] }),
    index("best_scores_board_idx").on(t.gameId, t.score.desc(), t.achievedAt),
  ],
);

export const userGameStats = pgTable(
  "user_game_stats",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id),
    plays: integer("plays").notNull().default(0),
    bestScore: integer("best_score").notNull().default(0),
    lastScore: integer("last_score").notNull().default(0),
    lastPlayedAt: timestamp("last_played_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.gameId] }),
    index("user_game_stats_recent_idx").on(t.userId, t.lastPlayedAt.desc()),
  ],
);

export const ratings = pgTable(
  "ratings",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id),
    stars: smallint("stars").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.gameId] }), index("ratings_game_idx").on(t.gameId)],
);

export const follows = pgTable(
  "follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetUserId: text("target_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** "accepted" today; friend requests start "pending" from T7.6. */
    status: followStatus("status").notNull().default("accepted"),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.targetUserId] }),
    index("follows_target_idx").on(t.targetUserId),
  ],
);

/** Last reported activity. Rows older than 2 minutes count as offline. */
export const presence = pgTable("presence", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  /** Game id only: titles come from the games table, never free text from the client. */
  gameId: text("game_id"),
  updatedAt: updatedAt(),
});

export const experienceLevels = pgTable("experience_levels", {
  level: integer("level").primaryKey(),
  requiredXp: integer("required_xp").notNull(),
  cumulativeXp: integer("cumulative_xp").notNull(),
});

export const screenNameHistory = pgTable(
  "screen_name_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    oldName: text("old_name").notNull(),
    newName: text("new_name").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("screen_name_history_user_idx").on(t.userId, t.changedAt.desc())],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Game = typeof games.$inferSelect;
export type Play = typeof plays.$inferSelect;
