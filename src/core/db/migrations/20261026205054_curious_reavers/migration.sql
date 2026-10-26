CREATE TABLE "article_tag" (
	"article_id" text,
	"tag_id" text,
	CONSTRAINT "article_tag_pkey" PRIMARY KEY("article_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL CONSTRAINT "tag_name_unique" UNIQUE
);
--> statement-breakpoint
CREATE INDEX "article_tag_tag_id_idx" ON "article_tag" ("tag_id");--> statement-breakpoint
ALTER TABLE "article_tag" ADD CONSTRAINT "article_tag_article_id_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "article_tag" ADD CONSTRAINT "article_tag_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE;