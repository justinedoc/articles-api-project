import type { Context } from "hono";
import * as httpStatusCodes from "stoker/http-status-codes";
import { AppError } from "@/core/errors";
import type { AppBindings, AppRouteHandler } from "@/core/types";
import type {
	ArchiveArticleRoute,
	CreateArticleRoute,
	DeleteArticleRoute,
	GetOwnedArticleRoute,
	GetPublicArticleRoute,
	ListPublicArticlesRoute,
	PublishArticleRoute,
	UpdateArticleRoute,
} from "./routes";
import {
	createArticle,
	deleteArticle,
	getOwnedArticle,
	getPublicArticle,
	listPublicArticles,
	transitionArticle,
	updateArticle,
} from "./service";

const authenticatedUser = (c: Context<AppBindings>) => {
	const user = c.get("user");
	if (!user) throw new AppError("Unauthorized", httpStatusCodes.UNAUTHORIZED);
	return user;
};

export const create: AppRouteHandler<CreateArticleRoute> = async (c) => {
	const result = await createArticle(
		authenticatedUser(c).id,
		c.req.valid("json"),
	);
	return c.json(
		{ success: true, message: "Article created successfully", data: result },
		httpStatusCodes.CREATED,
	);
};

export const getPublic: AppRouteHandler<GetPublicArticleRoute> = async (c) => {
	const result = await getPublicArticle(c.req.valid("param").id);
	return c.json(
		{ success: true, message: "Article retrieved successfully", data: result },
		httpStatusCodes.OK,
	);
};

export const listPublic: AppRouteHandler<ListPublicArticlesRoute> = async (
	c,
) => {
	const { cursor, limit } = c.req.valid("query");
	const result = await listPublicArticles(cursor, limit);
	return c.json(
		{
			success: true,
			message: "Articles retrieved successfully",
			data: result,
		},
		httpStatusCodes.OK,
	);
};

export const getMine: AppRouteHandler<GetOwnedArticleRoute> = async (c) => {
	const user = authenticatedUser(c);
	const result = await getOwnedArticle(c.req.valid("param").id, user.id);
	return c.json(
		{ success: true, message: "Article retrieved successfully", data: result },
		httpStatusCodes.OK,
	);
};

export const update: AppRouteHandler<UpdateArticleRoute> = async (c) => {
	const user = authenticatedUser(c);
	const result = await updateArticle(
		c.req.valid("param").id,
		user.id,
		c.req.valid("json"),
	);
	return c.json(
		{ success: true, message: "Article updated successfully", data: result },
		httpStatusCodes.OK,
	);
};

export const remove: AppRouteHandler<DeleteArticleRoute> = async (c) => {
	const user = authenticatedUser(c);
	await deleteArticle(c.req.valid("param").id, user.id);
	return c.json(
		{ success: true, message: "Article deleted successfully" },
		httpStatusCodes.OK,
	);
};

export const publish: AppRouteHandler<PublishArticleRoute> = async (c) => {
	const user = authenticatedUser(c);
	const result = await transitionArticle(
		c.req.valid("param").id,
		user.id,
		"published",
	);
	return c.json(
		{
			success: true,
			message: "Article status updated successfully",
			data: result,
		},
		httpStatusCodes.OK,
	);
};

export const archive: AppRouteHandler<ArchiveArticleRoute> = async (c) => {
	const user = authenticatedUser(c);
	const result = await transitionArticle(
		c.req.valid("param").id,
		user.id,
		"archived",
	);
	return c.json(
		{
			success: true,
			message: "Article status updated successfully",
			data: result,
		},
		httpStatusCodes.OK,
	);
};
