import { createRoute } from "@hono/zod-openapi";
import * as httpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { authMiddleware } from "@/core/auth/middleware";
import {
	cursorPaginationResultSchema,
	defaultErrorResponses,
} from "@/core/openapi/helpers";
import { createMessageSchema } from "@/core/openapi/schemas";
import { cursorPaginationQuerySchema } from "@/core/pagination";
import {
	articleCreateSchema,
	articleIdParamSchema,
	articleSelectSchema,
	articleUpdateSchema,
} from "./schema";

const tags = ["Articles"];
const security = [{ BearerAuth: [] }];
const articleResponse = (message: string) =>
	jsonContent(
		createMessageSchema(message, true).extend({ data: articleSelectSchema }),
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

export const getPublicArticleRoute = createRoute({
	method: "get",
	path: "/{id}",
	summary: "Get a published article",
	tags,
	request: { params: articleIdParamSchema },
	responses: {
		[httpStatusCodes.OK]: articleResponse("Article retrieved successfully"),
		...defaultErrorResponses,
	},
});

export const listPublicArticlesRoute = createRoute({
	method: "get",
	path: "/",
	summary: "List published articles",
	tags,
	request: { query: cursorPaginationQuerySchema },
	responses: {
		[httpStatusCodes.OK]: jsonContent(
			createMessageSchema("Articles retrieved successfully", true).extend({
				data: cursorPaginationResultSchema(articleSelectSchema),
			}),
			"Articles retrieved successfully",
		),
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

export type CreateArticleRoute = typeof createArticleRoute;
export type GetPublicArticleRoute = typeof getPublicArticleRoute;
export type ListPublicArticlesRoute = typeof listPublicArticlesRoute;
export type GetOwnedArticleRoute = typeof getOwnedArticleRoute;
export type UpdateArticleRoute = typeof updateArticleRoute;
export type DeleteArticleRoute = typeof deleteArticleRoute;
export type PublishArticleRoute = typeof publishArticleRoute;
export type ArchiveArticleRoute = typeof archiveArticleRoute;
