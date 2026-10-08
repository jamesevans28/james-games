CREATE TYPE "public"."account_type" AS ENUM('anonymous', 'username_pin', 'linked');--> statement-breakpoint
CREATE TYPE "public"."follow_status" AS ENUM('pending', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('active', 'beta', 'inactive');--> statement-breakpoint
CREATE TABLE "best_scores" (
	"user_id" text NOT NULL,
	"game_id" text NOT NULL,
	"score" integer NOT NULL,
	"play_id" uuid,
	"achieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "best_scores_user_id_game_id_pk" PRIMARY KEY("user_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "experience_levels" (
	"level" integer PRIMARY KEY NOT NULL,
	"required_xp" integer NOT NULL,
	"cumulative_xp" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"user_id" text NOT NULL,
	"target_user_id" text NOT NULL,
	"status" "follow_status" DEFAULT 'accepted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_user_id_target_user_id_pk" PRIMARY KEY("user_id","target_user_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "game_status" DEFAULT 'active' NOT NULL,
	"xp_multiplier" real DEFAULT 1 NOT NULL,
	"max_score" integer NOT NULL,
	"max_score_per_second" integer NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"game_id" text NOT NULL,
	"score" integer NOT NULL,
	"duration_ms" integer,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"remix_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presence" (
	"user_id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"game_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"user_id" text NOT NULL,
	"game_id" text NOT NULL,
	"stars" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_user_id_game_id_pk" PRIMARY KEY("user_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "screen_name_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"old_name" text NOT NULL,
	"new_name" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_game_stats" (
	"user_id" text NOT NULL,
	"game_id" text NOT NULL,
	"plays" integer DEFAULT 0 NOT NULL,
	"best_score" integer DEFAULT 0 NOT NULL,
	"last_score" integer DEFAULT 0 NOT NULL,
	"last_played_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_game_stats_user_id_game_id_pk" PRIMARY KEY("user_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text,
	"screen_name" text NOT NULL,
	"screen_name_set_by_user" boolean DEFAULT false NOT NULL,
	"avatar" integer DEFAULT 1 NOT NULL,
	"account_type" "account_type" DEFAULT 'anonymous' NOT NULL,
	"pin_hash" text,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"admin" boolean DEFAULT false NOT NULL,
	"beta_tester" boolean DEFAULT false NOT NULL,
	"xp_total" integer DEFAULT 0 NOT NULL,
	"xp_level" integer DEFAULT 1 NOT NULL,
	"xp_progress" integer DEFAULT 0 NOT NULL,
	"streak_current" integer DEFAULT 0 NOT NULL,
	"streak_longest" integer DEFAULT 0 NOT NULL,
	"streak_last_day" date,
	"disabled_at" timestamp with time zone,
	"prefs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "best_scores" ADD CONSTRAINT "best_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "best_scores" ADD CONSTRAINT "best_scores_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "best_scores" ADD CONSTRAINT "best_scores_play_id_plays_id_fk" FOREIGN KEY ("play_id") REFERENCES "public"."plays"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plays" ADD CONSTRAINT "plays_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plays" ADD CONSTRAINT "plays_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence" ADD CONSTRAINT "presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screen_name_history" ADD CONSTRAINT "screen_name_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_game_stats" ADD CONSTRAINT "user_game_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_game_stats" ADD CONSTRAINT "user_game_stats_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "best_scores_board_idx" ON "best_scores" USING btree ("game_id","score" DESC NULLS LAST,"achieved_at");--> statement-breakpoint
CREATE INDEX "follows_target_idx" ON "follows" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "plays_game_score_idx" ON "plays" USING btree ("game_id","score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "plays_user_created_idx" ON "plays" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ratings_game_idx" ON "ratings" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "screen_name_history_user_idx" ON "screen_name_history" USING btree ("user_id","changed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_game_stats_recent_idx" ON "user_game_stats" USING btree ("user_id","last_played_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_key" ON "users" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_screen_name_lower_key" ON "users" USING btree (lower("screen_name"));