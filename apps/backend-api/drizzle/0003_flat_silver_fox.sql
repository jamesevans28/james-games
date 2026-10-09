CREATE TYPE "public"."supporter_source" AS ENUM('stripe', 'apple', 'google', 'manual');--> statement-breakpoint
CREATE TABLE "supporters" (
	"user_id" text PRIMARY KEY NOT NULL,
	"source" "supporter_source" NOT NULL,
	"external_id" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supporters" ADD CONSTRAINT "supporters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "supporters_external_key" ON "supporters" USING btree ("source","external_id");