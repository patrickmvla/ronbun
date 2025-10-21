CREATE TYPE "public"."digest_status" AS ENUM('scheduled', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."explain_level" AS ENUM('eli5', 'student', 'expert');--> statement-breakpoint
CREATE TYPE "public"."save_status" AS ENUM('queued', 'saved', 'reading', 'done');--> statement-breakpoint
CREATE TYPE "public"."watchlist_type" AS ENUM('keyword', 'author', 'benchmark', 'institution');--> statement-breakpoint
CREATE TABLE "authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"norm_name" text,
	"orcid" varchar(32)
);
--> statement-breakpoint
CREATE TABLE "digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb,
	"status" "digest_status" DEFAULT 'scheduled',
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "explanations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" uuid NOT NULL,
	"level" "explain_level" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ingest_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now(),
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'ok',
	"items_fetched" integer DEFAULT 0,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "paper_authors" (
	"paper_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pk_paper_authors" PRIMARY KEY("paper_id","author_id")
);
--> statement-breakpoint
CREATE TABLE "paper_enrich" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" uuid NOT NULL,
	"code_urls" jsonb DEFAULT '[]'::jsonb,
	"primary_repo" text,
	"repo_license" text,
	"repo_stars" integer,
	"has_weights" boolean,
	"readme_excerpt" text,
	"readme_sha" text,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "paper_scores" (
	"paper_id" uuid PRIMARY KEY NOT NULL,
	"global_score" numeric DEFAULT '0' NOT NULL,
	"components" jsonb,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "paper_structured" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" uuid NOT NULL,
	"method" text,
	"tasks" jsonb DEFAULT '[]'::jsonb,
	"datasets" jsonb DEFAULT '[]'::jsonb,
	"benchmarks" jsonb DEFAULT '[]'::jsonb,
	"claimed_sota" jsonb DEFAULT '[]'::jsonb,
	"params" numeric,
	"tokens" numeric,
	"compute" text,
	"code_urls" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "paper_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"abstract" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "papers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"arxiv_id_base" varchar(32) NOT NULL,
	"latest_version" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"abstract" text NOT NULL,
	"categories" text[] NOT NULL,
	"primary_category" varchar(32),
	"published_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"pdf_url" text,
	"abs_url" text,
	"comment" text,
	"tsv" text
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"preferences" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pwc_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" uuid NOT NULL,
	"found" boolean DEFAULT false NOT NULL,
	"paper_url" text,
	"repo_url" text,
	"repo_stars" integer,
	"search_url" text,
	"sota_links" jsonb DEFAULT '[]'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" uuid NOT NULL,
	"strengths" jsonb DEFAULT '[]'::jsonb,
	"weaknesses" jsonb DEFAULT '[]'::jsonb,
	"risks" jsonb DEFAULT '[]'::jsonb,
	"next_experiments" jsonb DEFAULT '[]'::jsonb,
	"reproducibility_notes" text,
	"novelty_score" integer,
	"clarity_score" integer,
	"caveats" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_saves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"paper_id" uuid NOT NULL,
	"status" "save_status" DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "watchlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "watchlist_type" NOT NULL,
	"name" text NOT NULL,
	"terms" jsonb DEFAULT '[]'::jsonb,
	"categories" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "explanations" ADD CONSTRAINT "explanations_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_authors" ADD CONSTRAINT "paper_authors_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_authors" ADD CONSTRAINT "paper_authors_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_enrich" ADD CONSTRAINT "paper_enrich_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_scores" ADD CONSTRAINT "paper_scores_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_structured" ADD CONSTRAINT "paper_structured_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_versions" ADD CONSTRAINT "paper_versions_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pwc_links" ADD CONSTRAINT "pwc_links_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saves" ADD CONSTRAINT "user_saves_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_authors_name" ON "authors" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_authors_norm_name" ON "authors" USING btree ("norm_name");--> statement-breakpoint
CREATE INDEX "idx_digests_user" ON "digests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_digests_scheduled_for" ON "digests" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_digests_status" ON "digests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_explainer" ON "explanations" USING btree ("paper_id","level");--> statement-breakpoint
CREATE INDEX "idx_explanations_created" ON "explanations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ingest_runs_started_at" ON "ingest_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_paper_authors_position" ON "paper_authors" USING btree ("position");--> statement-breakpoint
CREATE INDEX "idx_paper_enrich_paper" ON "paper_enrich" USING btree ("paper_id");--> statement-breakpoint
CREATE INDEX "idx_paper_enrich_updated" ON "paper_enrich" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_paper_scores_updated" ON "paper_scores" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_paper_structured_paper" ON "paper_structured" USING btree ("paper_id");--> statement-breakpoint
CREATE INDEX "idx_paper_structured_created" ON "paper_structured" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_paper_version" ON "paper_versions" USING btree ("paper_id","version");--> statement-breakpoint
CREATE INDEX "idx_paper_versions_updated" ON "paper_versions" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_papers_arxiv" ON "papers" USING btree ("arxiv_id_base");--> statement-breakpoint
CREATE INDEX "idx_papers_primary_cat" ON "papers" USING btree ("primary_category");--> statement-breakpoint
CREATE INDEX "idx_papers_published" ON "papers" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_profiles_updated" ON "profiles" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_pwc_links_paper" ON "pwc_links" USING btree ("paper_id");--> statement-breakpoint
CREATE INDEX "idx_pwc_links_updated" ON "pwc_links" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_reviews_paper" ON "reviews" USING btree ("paper_id");--> statement-breakpoint
CREATE INDEX "idx_reviews_created" ON "reviews" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_user_save" ON "user_saves" USING btree ("user_id","paper_id");--> statement-breakpoint
CREATE INDEX "idx_user_saves_user" ON "user_saves" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_watchlists_user" ON "watchlists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_watchlists_type" ON "watchlists" USING btree ("type");