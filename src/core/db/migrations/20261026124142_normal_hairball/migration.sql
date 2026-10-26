CREATE TYPE "article_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "article" (
	"id" text PRIMARY KEY,
	"author_id" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"excerpt" text,
	"body" text NOT NULL,
	"status" "article_status" NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment" (
	"id" text PRIMARY KEY,
	"article_id" text NOT NULL,
	"author_id" text NOT NULL,
	"parent_id" text,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "article_status_published_at_idx" ON "article" ("status","published_at");--> statement-breakpoint
CREATE INDEX "article_author_id_idx" ON "article" ("author_id");--> statement-breakpoint
CREATE INDEX "comment_article_id_created_at_idx" ON "comment" ("article_id","created_at");--> statement-breakpoint
CREATE INDEX "comment_parent_id_created_at_idx" ON "comment" ("parent_id","created_at");--> statement-breakpoint
CREATE INDEX "comment_author_id_idx" ON "comment" ("author_id");--> statement-breakpoint
ALTER TABLE "article" ADD CONSTRAINT "article_author_id_user_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_article_id_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_author_id_user_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_parent_id_comment_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comment"("id") ON DELETE CASCADE;