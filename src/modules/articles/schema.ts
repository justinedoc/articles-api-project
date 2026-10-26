import { z } from "@hono/zod-openapi";
import { createSchemaFactory } from "drizzle-orm/zod";
import { article } from "@/core/db/schema";

const { createSelectSchema } = createSchemaFactory({
	zodInstance: z,
});

export const articleSelectSchema = createSelectSchema(article);

export const articleCreateSchema = z.object({
	title: z.string().trim().min(1).max(200),
	excerpt: z.string().trim().max(500).nullable().optional(),
	body: z.string().min(1),
});

export const articleUpdateSchema = articleCreateSchema.partial();

export const articleIdParamSchema = z.object({
	id: z.string().min(1),
});

export type ArticleCreatePayload = z.infer<typeof articleCreateSchema>;
export type ArticleUpdatePayload = z.infer<typeof articleUpdateSchema>;
export type SelectArticle = z.infer<typeof articleSelectSchema>;
