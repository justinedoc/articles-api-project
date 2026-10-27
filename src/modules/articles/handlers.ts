import type { Context } from "hono";
import * as httpStatusCodes from "stoker/http-status-codes";
import { AppError } from "@/core/errors";
import { setCacheHeaders, setPrivateCacheHeaders } from "@/core/server";
import type { AppBindings, AppRouteHandler } from "@/core/types";
import type {
	ArchiveArticleRoute,
	CreateArticleRoute,
	DeleteArticleRoute,
	GetOwnedArticleRoute,
	GetPublicArticleRoute,
	GetTrendingArticlesRoute,
	LikeArticleRoute,
	ListOwnedArticlesRoute,
	ListPublicArticlesRoute,
	PublishArticleRoute,
	UnlikeArticleRoute,
	UpdateArticleRoute,
} from "./routes";
import {
	createArticle,
	deleteArticle,
	getOwnedArticle,
	getPublicArticle,
	getTrendingArticles,
	likeArticle,
	listOwnedArticles,
	listPublicArticles,
	transitionArticle,
	unlikeArticle,
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
	setPrivateCacheHeaders(c);
	return c.json(
		{ success: true, message: "Article created successfully", data: result },
		httpStatusCodes.CREATED,
	);
};

export const trending: AppRouteHandler<GetTrendingArticlesRoute> = async (
	c,
) => {
	const { limit } = c.req.valid("query");
	const user = c.get("user");
	const result = await getTrendingArticles(limit, user?.id);
	setCacheHeaders(c, Boolean(user), 60, 300);
	return c.json(
		{
			success: true,
			message: "Trending articles retrieved successfully",
			data: result,
		},
		httpStatusCodes.OK,
	);
};

export const getPublic: AppRouteHandler<GetPublicArticleRoute> = async (c) => {
	const user = c.get("user");
	const result = await getPublicArticle(c.req.valid("param").id, user?.id);
	setCacheHeaders(c, Boolean(user), 60, 300);
	return c.json(
		{ success: true, message: "Article retrieved successfully", data: result },
		httpStatusCodes.OK,
	);
};

export const listPublic: AppRouteHandler<ListPublicArticlesRoute> = async (
	c,
) => {
	const { cursor, limit, tag, search, author } = c.req.valid("query");
	const user = c.get("user");
	const result = await listPublicArticles(
		cursor,
		limit,
		tag,
		search,
		author,
		user?.id,
	);
	setCacheHeaders(c, Boolean(user), 60, 300);
	return c.json(
		{
			success: true,
			message: "Articles retrieved successfully",
			data: result,
		},
		httpStatusCodes.OK,
	);
};

export const listMine: AppRouteHandler<ListOwnedArticlesRoute> = async (c) => {
	const user = authenticatedUser(c);
	const { cursor, limit, status, tag, search } = c.req.valid("query");
	const result = await listOwnedArticles(
		user.id,
		cursor,
		limit,
		status,
		tag,
		search,
	);
	setPrivateCacheHeaders(c);
	return c.json(
		{
			success: true,
			message: "Owned articles retrieved successfully",
			data: result,
		},
		httpStatusCodes.OK,
	);
};

export const getMine: AppRouteHandler<GetOwnedArticleRoute> = async (c) => {
	const user = authenticatedUser(c);
	const result = await getOwnedArticle(c.req.valid("param").id, user.id);
	setPrivateCacheHeaders(c);
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
	setPrivateCacheHeaders(c);
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
	setPrivateCacheHeaders(c);
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
	setPrivateCacheHeaders(c);
	return c.json(
		{
			success: true,
			message: "Article status updated successfully",
			data: result,
		},
		httpStatusCodes.OK,
	);
};

export const like: AppRouteHandler<LikeArticleRoute> = async (c) => {
	const result = await likeArticle(
		c.req.valid("param").id,
		authenticatedUser(c).id,
	);
	return c.json(
		{ success: true, message: "Article liked successfully", data: result },
		httpStatusCodes.OK,
	);
};

export const unlike: AppRouteHandler<UnlikeArticleRoute> = async (c) => {
	const result = await unlikeArticle(
		c.req.valid("param").id,
		authenticatedUser(c).id,
	);
	return c.json(
		{ success: true, message: "Article unliked successfully", data: result },
		httpStatusCodes.OK,
	);
};
