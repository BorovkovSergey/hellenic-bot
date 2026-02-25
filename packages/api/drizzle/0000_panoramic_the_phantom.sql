CREATE TYPE "public"."srs_stage" AS ENUM('new', 'stage_1', 'stage_2', 'stage_3', 'stage_4', 'learned');--> statement-breakpoint
CREATE TABLE "exercise_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"word_id" integer NOT NULL,
	"exercise_type" varchar(50) NOT NULL,
	"is_correct" boolean NOT NULL,
	"answer_given" varchar(500),
	"time_spent_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"word_id" integer NOT NULL,
	"srs_stage" "srs_stage" DEFAULT 'new' NOT NULL,
	"next_review_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255),
	"username" varchar(255),
	"language_code" varchar(10),
	"display_language" varchar(10) DEFAULT 'en' NOT NULL,
	"words_per_lesson" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
CREATE TABLE "words" (
	"id" serial PRIMARY KEY NOT NULL,
	"original" varchar(255) NOT NULL,
	"transcription" varchar(255),
	"translations" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "words_original_unique" UNIQUE("original")
);
--> statement-breakpoint
ALTER TABLE "exercise_results" ADD CONSTRAINT "exercise_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_results" ADD CONSTRAINT "exercise_results_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercise_results_user_id_idx" ON "exercise_results" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "exercise_results_word_id_idx" ON "exercise_results" USING btree ("word_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_progress_user_word_idx" ON "user_progress" USING btree ("user_id","word_id");--> statement-breakpoint
CREATE INDEX "user_progress_review_idx" ON "user_progress" USING btree ("user_id","srs_stage","next_review_at");