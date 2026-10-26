import { z } from "@hono/zod-openapi";
import { createSchemaFactory } from "drizzle-orm/zod";
import { comment } from "@/core/db/schema";
import { cursorPaginationQuerySchema } from "@/core/pagination";

const { createSelectSchema } = createSchemaFactory({ zodInstance: z });

export const commentSelectSchema = createSelectSchema(comment);
export const commentCreateSchema = z.object({
	body: z.string().trim().min(1).max(5000),
	parentId: z.string().min(1).nullable().optional(),
});
export const commentIdParamSchema = z.object({
	commentId: z.string().min(1),
});
export const articleCommentsParamSchema = z.object({
	articleId: z.string().min(1),
});
export const commentListQuerySchema = cursorPaginationQuerySchema;

export type CommentCreatePayload = z.infer<typeof commentCreateSchema>;
export type SelectComment = z.infer<typeof commentSelectSchema>;
