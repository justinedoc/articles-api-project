import { createRoute, z } from "@hono/zod-openapi";
import * as httpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { authMiddleware } from "@/core/auth/middleware";
import {
	cursorPaginationResultSchema,
	defaultErrorResponses,
} from "@/core/openapi/helpers";
import { createMessageSchema } from "@/core/openapi/schemas";
import {
	articleCommentsParamSchema,
	commentCreateSchema,
	commentIdParamSchema,
	commentItemSchema,
	commentListQuerySchema,
	commentRepliesQuerySchema,
	commentSelectSchema,
	commentTreeNodeSchema,
} from "./schema";

const tags = ["Comments"];
const security = [{ BearerAuth: [] }];
const commentResponse = (message: string) =>
	jsonContent(
		createMessageSchema(message, true).extend({ data: commentSelectSchema }),
		message,
	);

export const listCommentsRoute = createRoute({
	method: "get",
	path: "/articles/{articleId}/comments",
	summary: "List root comments for a published article",
	description:
		"Paginates only top-level discussion comments for an article, including the total reply count for each thread.",
	tags,
	request: {
		params: articleCommentsParamSchema,
		query: commentListQuerySchema,
	},
	responses: {
		[httpStatusCodes.OK]: jsonContent(
			createMessageSchema("Comments retrieved successfully", true).extend({
				data: cursorPaginationResultSchema(commentItemSchema),
			}),
			"Root comments for an article",
		),
		...defaultErrorResponses,
	},
});

export const listCommentRepliesRoute = createRoute({
	method: "get",
	path: "/comments/{commentId}/replies",
	summary: "List replies for a comment",
	description:
		"Loads direct replies for a comment on demand with pagination, or the full recursive reply tree when ?tree=true.",
	tags,
	request: {
		params: commentIdParamSchema,
		query: commentRepliesQuerySchema,
	},
	responses: {
		[httpStatusCodes.OK]: jsonContent(
			createMessageSchema("Replies retrieved successfully", true).extend({
				data: cursorPaginationResultSchema(commentTreeNodeSchema),
			}),
			"Replies for a comment",
		),
		...defaultErrorResponses,
	},
});

export const createCommentRoute = createRoute({
	method: "post",
	path: "/articles/{articleId}/comments",
	summary: "Create a comment or reply",
	tags,
	security,
	middleware: [authMiddleware],
	request: {
		params: articleCommentsParamSchema,
		body: jsonContentRequired(commentCreateSchema, "Comment details"),
	},
	responses: {
		[httpStatusCodes.CREATED]: commentResponse("Comment created successfully"),
		...defaultErrorResponses,
	},
});

export const updateCommentRoute = createRoute({
	method: "patch",
	path: "/comments/{commentId}",
	summary: "Edit an owned comment",
	tags,
	security,
	middleware: [authMiddleware],
	request: {
		params: commentIdParamSchema,
		body: jsonContentRequired(
			z.object({ body: commentCreateSchema.shape.body }),
			"Comment details",
		),
	},
	responses: {
		[httpStatusCodes.OK]: commentResponse("Comment updated successfully"),
		...defaultErrorResponses,
	},
});

export const deleteCommentRoute = createRoute({
	method: "delete",
	path: "/comments/{commentId}",
	summary: "Soft-delete an owned comment",
	tags,
	security,
	middleware: [authMiddleware],
	request: { params: commentIdParamSchema },
	responses: {
		[httpStatusCodes.OK]: commentResponse("Comment deleted successfully"),
		...defaultErrorResponses,
	},
});

export type ListCommentsRoute = typeof listCommentsRoute;
export type ListCommentRepliesRoute = typeof listCommentRepliesRoute;
export type CreateCommentRoute = typeof createCommentRoute;
export type UpdateCommentRoute = typeof updateCommentRoute;
export type DeleteCommentRoute = typeof deleteCommentRoute;
