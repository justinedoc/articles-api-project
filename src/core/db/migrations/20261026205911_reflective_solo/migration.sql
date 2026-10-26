CREATE TABLE "article_like" (
	"article_id" text,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "article_like_pkey" PRIMARY KEY("article_id","user_id")
);
--> statement-breakpoint
CREATE INDEX "article_like_user_id_idx" ON "article_like" ("user_id");--> statement-breakpoint
ALTER TABLE "article_like" ADD CONSTRAINT "article_like_article_id_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "article_like" ADD CONSTRAINT "article_like_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;