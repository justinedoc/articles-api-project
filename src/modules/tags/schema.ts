import { z } from "@hono/zod-openapi";

export const tagItemSchema = z.object({
	id: z.string().openapi({
		description: "Unique tag identifier",
		example: "tag_12345",
	}),
	name: z.string().openapi({
		description: "Normalized tag name (lowercase, unique)",
		example: "typescript",
	}),
	articleCount: z.number().openapi({
		description: "Total number of published articles with this tag",
		example: 12,
	}),
});

export const popularTagsQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(20).openapi({
		description: "Maximum number of popular tags to return",
		example: 20,
	}),
});

export type TagItem = z.infer<typeof tagItemSchema>;
export type PopularTagsQuery = z.infer<typeof popularTagsQuerySchema>;
