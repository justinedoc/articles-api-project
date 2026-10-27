import { z } from "@hono/zod-openapi";
import { createSchemaFactory } from "drizzle-orm/zod";
import { article } from "@/core/db/schema";
import { cursorPaginationQuerySchema } from "@/core/pagination";

const { createSelectSchema } = createSchemaFactory({
	zodInstance: z,
});

export const articleSelectSchema = createSelectSchema(article);

export const articleCreateSchema = z.object({
	title: z.string().trim().min(1).max(200).openapi({
		description: "Article title",
		example: "Mastering TypeScript and Distributed Systems",
	}),
	excerpt: z.string().trim().max(500).nullable().optional().openapi({
		description: "Short summary or preview of the article",
		example: "An in-depth guide to modern TypeScript architectures.",
	}),
	body: z.string().min(1).openapi({
		description: "Full markdown or text body content",
		example:
			"# Introduction\n\nTypeScript provides robust static typing for web backends.",
	}),
	tags: z
		.array(z.string().trim().min(1).max(50))
		.max(10)
		.optional()
		.openapi({
			description: "List of up to 10 topic tags",
			example: ["typescript", "architecture", "nodejs"],
		}),
});

export const articleUpdateSchema = articleCreateSchema.partial();

export const articleIdParamSchema = z.object({
	id: z
		.string()
		.min(1)
		.openapi({
			param: {
				name: "id",
				in: "path",
			},
			description: "Unique article identifier",
			example: "art_12345678",
		}),
});
export const articleListQuerySchema = cursorPaginationQuerySchema.extend({
	tag: z
		.string()
		.trim()
		.min(1)
		.max(50)
		.optional()
		.openapi({
			param: {
				name: "tag",
				in: "query",
			},
			description: "Filter articles by tag name",
			example: "typescript",
		}),
	search: z
		.string()
		.trim()
		.min(1)
		.max(100)
		.optional()
		.openapi({
			param: {
				name: "search",
				in: "query",
			},
			description: "Full-text search query matching article title and content",
		}),
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

export const ownArticlesQuerySchema = cursorPaginationQuerySchema.extend({
	status: z
		.enum(["draft", "published", "archived"])
		.optional()
		.openapi({
			param: {
				name: "status",
				in: "query",
			},
			description:
				"Filter own articles by status (draft, published, or archived)",
			example: "draft",
		}),
	tag: z
		.string()
		.trim()
		.min(1)
		.max(50)
		.optional()
		.openapi({
			param: {
				name: "tag",
				in: "query",
			},
			description: "Filter own articles by tag name",
			example: "typescript",
		}),
	search: z
		.string()
		.trim()
		.min(1)
		.max(100)
		.optional()
		.openapi({
			param: {
				name: "search",
				in: "query",
			},
			description: "Search own articles matching title and content",
		}),
});

export type ArticleCreatePayload = z.infer<typeof articleCreateSchema>;
export type ArticleUpdatePayload = z.infer<typeof articleUpdateSchema>;
export type SelectArticle = z.infer<typeof articleSelectSchema>;
export type TrendingArticle = z.infer<typeof trendingArticleSchema>;
export type TrendingArticlesQuery = z.infer<typeof trendingArticlesQuerySchema>;
export type OwnArticlesQuery = z.infer<typeof ownArticlesQuerySchema>;
