CREATE TABLE "daily_runs" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"game_id" text NOT NULL,
	"score" integer NOT NULL,
	"play_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_runs_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "family_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"parent_user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_links" (
	"parent_user_id" text NOT NULL,
	"child_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_links_parent_user_id_child_user_id_pk" PRIMARY KEY("parent_user_id","child_user_id")
);
--> statement-breakpoint
CREATE TABLE "remixes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"game_id" text NOT NULL,
	"name" text NOT NULL,
	"knobs" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_runs" ADD CONSTRAINT "daily_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_runs" ADD CONSTRAINT "daily_runs_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_runs" ADD CONSTRAINT "daily_runs_play_id_plays_id_fk" FOREIGN KEY ("play_id") REFERENCES "public"."plays"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_codes" ADD CONSTRAINT "family_codes_parent_user_id_users_id_fk" FOREIGN KEY ("parent_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_links" ADD CONSTRAINT "family_links_parent_user_id_users_id_fk" FOREIGN KEY ("parent_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_links" ADD CONSTRAINT "family_links_child_user_id_users_id_fk" FOREIGN KEY ("child_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remixes" ADD CONSTRAINT "remixes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remixes" ADD CONSTRAINT "remixes_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_runs_board_idx" ON "daily_runs" USING btree ("day","score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "family_links_child_idx" ON "family_links" USING btree ("child_user_id");--> statement-breakpoint
CREATE INDEX "remixes_game_idx" ON "remixes" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "remixes_owner_idx" ON "remixes" USING btree ("owner_id");--> statement-breakpoint
ALTER TABLE "plays" ADD CONSTRAINT "plays_remix_id_remixes_id_fk" FOREIGN KEY ("remix_id") REFERENCES "public"."remixes"("id") ON DELETE set null ON UPDATE no action;