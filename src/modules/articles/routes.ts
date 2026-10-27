import { createRoute, z } from "@hono/zod-openapi";
import * as httpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { authMiddleware, optionalAuthMiddleware } from "@/core/auth/middleware";
import {
	cursorPaginationResultSchema,
	defaultErrorResponses,
} from "@/core/openapi/helpers";
import { createMessageSchema } from "@/core/openapi/schemas";
import {
	articleCreateSchema,
	articleIdParamSchema,
	articleListQuerySchema,
	articleResponseSchema,
	articleUpdateSchema,
	ownArticlesQuerySchema,
	trendingArticleSchema,
	trendingArticlesQuerySchema,
} from "./schema";

const tags = ["Articles"];
const security = [{ BearerAuth: [] }];
const articleResponse = (message: string) =>
	jsonContent(
		createMessageSchema(message, true).extend({ data: articleResponseSchema }),
		message,
	);
const likeResponse = (message: string) =>
	jsonContent(
		createMessageSchema(message, true).extend({
			data: z.object({ count: z.number(), liked: z.boolean() }),
		}),
		message,
	);

export const createArticleRoute = createRoute({
	method: "post",
	path: "/",
	summary: "Create an article draft",
	tags,
	security,
	middleware: [authMiddleware],
	request: {
		body: jsonContentRequired(articleCreateSchema, "Article details"),
	},
	responses: {
		[httpStatusCodes.CREATED]: articleResponse("Article created successfully"),
		...defaultErrorResponses,
	},
});

export const listPublicArticlesRoute = createRoute({
	method: "get",
	path: "/",
	summary: "List published articles",
	tags,
	middleware: [optionalAuthMiddleware],
	request: { query: articleListQuerySchema },
	responses: {
		[httpStatusCodes.OK]: jsonContent(
			createMessageSchema("Articles retrieved successfully", true).extend({
				data: cursorPaginationResultSchema(articleResponseSchema),
			}),
			"Articles retrieved successfully",
		),
		...defaultErrorResponses,
	},
});

export const getTrendingArticlesRoute = createRoute({
	method: "get",
	path: "/trending",
	summary: "List trending published articles",
	tags,
	middleware: [optionalAuthMiddleware],
	request: { query: trendingArticlesQuerySchema },
	responses: {
		[httpStatusCodes.OK]: jsonContent(
			createMessageSchema(
				"Trending articles retrieved successfully",
				true,
			).extend({
				data: z.array(trendingArticleSchema),
			}),
			"Trending articles retrieved successfully",
		),
		...defaultErrorResponses,
	},
});

export const listOwnedArticlesRoute = createRoute({
	method: "get",
	path: "/mine",
	summary: "List owned articles",
	tags,
	security,
	middleware: [authMiddleware],
	request: { query: ownArticlesQuerySchema },
	responses: {
		[httpStatusCodes.OK]: jsonContent(
			createMessageSchema("Owned articles retrieved successfully", true).extend(
				{
					data: cursorPaginationResultSchema(articleResponseSchema),
				},
			),
			"Owned articles retrieved successfully",
		),
		...defaultErrorResponses,
	},
});

export const getPublicArticleRoute = createRoute({
	method: "get",
	path: "/{id}",
	summary: "Get a published article",
	tags,
	middleware: [optionalAuthMiddleware],
	request: { params: articleIdParamSchema },
	responses: {
		[httpStatusCodes.OK]: articleResponse("Article retrieved successfully"),
		...defaultErrorResponses,
	},
});

export const getOwnedArticleRoute = createRoute({
	method: "get",
	path: "/{id}/mine",
	summary: "Get an owned article",
	tags,
	security,
	middleware: [authMiddleware],
	request: { params: articleIdParamSchema },
	responses: {
		[httpStatusCodes.OK]: articleResponse("Article retrieved successfully"),
		...defaultErrorResponses,
	},
});

export const updateArticleRoute = createRoute({
	method: "patch",
	path: "/{id}",
	summary: "Update an owned article",
	tags,
	security,
	middleware: [authMiddleware],
	request: {
		params: articleIdParamSchema,
		body: jsonContentRequired(articleUpdateSchema, "Article updates"),
	},
	responses: {
		[httpStatusCodes.OK]: articleResponse("Article updated successfully"),
		...defaultErrorResponses,
	},
});

const transitionRoute = (path: string, summary: string) =>
	createRoute({
		method: "post",
		path,
		summary,
		tags,
		security,
		middleware: [authMiddleware],
		request: { params: articleIdParamSchema },
		responses: {
			[httpStatusCodes.OK]: articleResponse(
				"Article status updated successfully",
			),
			...defaultErrorResponses,
		},
	});

export const publishArticleRoute = transitionRoute(
	"/{id}/publish",
	"Publish or restore an article",
);

export const archiveArticleRoute = transitionRoute(
	"/{id}/archive",
	"Archive an article",
);

export const deleteArticleRoute = createRoute({
	method: "delete",
	path: "/{id}",
	summary: "Delete an owned article",
	tags,
	security,
	middleware: [authMiddleware],
	request: { params: articleIdParamSchema },
	responses: {
		[httpStatusCodes.OK]: jsonContent(
			createMessageSchema("Article deleted successfully", true),
			"Article deleted successfully",
		),
		...defaultErrorResponses,
	},
});

export const likeArticleRoute = createRoute({
	method: "post",
	path: "/{id}/like",
	summary: "Like a published article",
	tags,
	security,
	middleware: [authMiddleware],
	request: { params: articleIdParamSchema },
	responses: {
		[httpStatusCodes.OK]: likeResponse("Article liked successfully"),
		...defaultErrorResponses,
	},
});

export const unlikeArticleRoute = createRoute({
	method: "delete",
	path: "/{id}/like",
	summary: "Unlike a published article",
	tags,
	security,
	middleware: [authMiddleware],
	request: { params: articleIdParamSchema },
	responses: {
		[httpStatusCodes.OK]: likeResponse("Article unliked successfully"),
		...defaultErrorResponses,
	},
});

export type CreateArticleRoute = typeof createArticleRoute;
export type ListPublicArticlesRoute = typeof listPublicArticlesRoute;
export type GetTrendingArticlesRoute = typeof getTrendingArticlesRoute;
export type ListOwnedArticlesRoute = typeof listOwnedArticlesRoute;
export type GetPublicArticleRoute = typeof getPublicArticleRoute;
export type GetOwnedArticleRoute = typeof getOwnedArticleRoute;
export type UpdateArticleRoute = typeof updateArticleRoute;
export type PublishArticleRoute = typeof publishArticleRoute;
export type ArchiveArticleRoute = typeof archiveArticleRoute;
export type DeleteArticleRoute = typeof deleteArticleRoute;
export type LikeArticleRoute = typeof likeArticleRoute;
export type UnlikeArticleRoute = typeof unlikeArticleRoute;
