import { z } from "@hono/zod-openapi";
import { createSchemaFactory } from "drizzle-orm/zod";
import { comment } from "@/core/db/schema";
import { cursorPaginationQuerySchema } from "@/core/pagination";

const { createSelectSchema } = createSchemaFactory({ zodInstance: z });

export const commentSelectSchema = createSelectSchema(comment);

export const commentItemSchema = commentSelectSchema.extend({
	replyCount: z.number().openapi({
		description: "Total number of direct replies to this comment",
		example: 2,
	}),
});

export type CommentItem = z.infer<typeof commentItemSchema>;

export type CommentTreeNode = CommentItem & {
	replies?: CommentTreeNode[];
};

export const commentTreeNodeSchema: z.ZodType<CommentTreeNode> =
	commentItemSchema
		.extend({
			replies: z.lazy(() => z.array(commentTreeNodeSchema)).optional(),
		})
		.openapi("CommentTreeNode");

export const commentCreateSchema = z.object({
	body: z.string().trim().min(1).max(5000).openapi({
		description: "Comment body text (1-5000 characters)",
		example: "This is a very insightful article, thanks for sharing!",
	}),
	parentId: z.string().min(1).nullable().optional().openapi({
		description:
			"ID of the parent comment if this is a reply, or null for root comments",
		example: "comm_parent_123",
	}),
});

export const commentIdParamSchema = z.object({
	commentId: z
		.string()
		.min(1)
		.openapi({
			param: {
				name: "commentId",
				in: "path",
			},
			description: "Unique comment identifier",
			example: "comm_12345",
		}),
});

export const articleCommentsParamSchema = z.object({
	articleId: z
		.string()
		.min(1)
		.openapi({
			param: {
				name: "articleId",
				in: "path",
			},
			description: "Unique article identifier",
			example: "art_12345",
		}),
});

export const commentListQuerySchema = cursorPaginationQuerySchema;

export const commentRepliesQuerySchema = cursorPaginationQuerySchema.extend({
	tree: z
		.string()
		.optional()
		.openapi({
			param: {
				name: "tree",
				in: "query",
			},
			description: "Set to 'true' to load the full recursive reply tree",
			example: "false",
		}),
});

export type CommentCreatePayload = z.infer<typeof commentCreateSchema>;
export type SelectComment = z.infer<typeof commentSelectSchema>;
export type CommentRepliesQuery = z.infer<typeof commentRepliesQuerySchema>;
