import { z } from "@hono/zod-openapi";
import { createSchemaFactory } from "drizzle-orm/zod";
import { article } from "@/core/db/schema";
import { cursorPaginationQuerySchema } from "@/core/pagination";

const { createSelectSchema } = createSchemaFactory({
	zodInstance: z,
});

export const articleSelectSchema = createSelectSchema(article);

export const articleCreateSchema = z.object({
	title: z.string().trim().min(1).max(200),
	excerpt: z.string().trim().max(500).nullable().optional(),
	body: z.string().min(1),
	tags: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
});

export const articleUpdateSchema = articleCreateSchema.partial();

export const articleIdParamSchema = z.object({
	id: z.string().min(1),
});
export const articleListQuerySchema = cursorPaginationQuerySchema.extend({
	tag: z.string().trim().min(1).max(50).optional(),
	search: z.string().trim().min(1).max(100).optional(),
});

export const trendingArticleSchema = articleSelectSchema.extend({
	engagementScore: z.number().openapi({
		description:
			"Composite engagement score based on recent likes and comments",
		example: 42,
	}),
	likeCount: z.number().openapi({
		description: "Total likes for this article",
		example: 18,
	}),
	commentCount: z.number().openapi({
		description: "Total comments for this article",
		example: 6,
	}),
});

export const trendingArticlesQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(50).default(10).openapi({
		description: "Maximum number of trending articles to return",
		example: 10,
	}),
});

export type ArticleCreatePayload = z.infer<typeof articleCreateSchema>;
export type ArticleUpdatePayload = z.infer<typeof articleUpdateSchema>;
export type SelectArticle = z.infer<typeof articleSelectSchema>;
export type TrendingArticle = z.infer<typeof trendingArticleSchema>;
export type TrendingArticlesQuery = z.infer<typeof trendingArticlesQuerySchema>;
