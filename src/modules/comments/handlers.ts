import type { Context } from "hono";
import * as httpStatusCodes from "stoker/http-status-codes";
import { AppError } from "@/core/errors";
import type { AppBindings, AppRouteHandler } from "@/core/types";
import type {
	CreateCommentRoute,
	DeleteCommentRoute,
	ListCommentsRoute,
	UpdateCommentRoute,
} from "./routes";
import {
	createComment,
	deleteComment,
	listComments,
	updateComment,
} from "./service";

const authenticatedUser = (c: Context<AppBindings>) => {
	const user = c.get("user");
	if (!user) throw new AppError("Unauthorized", httpStatusCodes.UNAUTHORIZED);
	return user;
};

export const list: AppRouteHandler<ListCommentsRoute> = async (c) => {
	const { articleId } = c.req.valid("param");
	const { cursor, limit } = c.req.valid("query");
	const result = await listComments(articleId, cursor, limit);
	return c.json(
		{ success: true, message: "Comments retrieved successfully", data: result },
		httpStatusCodes.OK,
	);
};

export const create: AppRouteHandler<CreateCommentRoute> = async (c) => {
	const user = authenticatedUser(c);
	const { articleId } = c.req.valid("param");
	const result = await createComment(articleId, user.id, c.req.valid("json"));
	return c.json(
		{ success: true, message: "Comment created successfully", data: result },
		httpStatusCodes.CREATED,
	);
};

export const update: AppRouteHandler<UpdateCommentRoute> = async (c) => {
	const user = authenticatedUser(c);
	const { commentId } = c.req.valid("param");
	const result = await updateComment(
		commentId,
		user.id,
		c.req.valid("json").body,
	);
	return c.json(
		{ success: true, message: "Comment updated successfully", data: result },
		httpStatusCodes.OK,
	);
};

export const remove: AppRouteHandler<DeleteCommentRoute> = async (c) => {
	const user = authenticatedUser(c);
	const { commentId } = c.req.valid("param");
	const result = await deleteComment(commentId, user.id);
	return c.json(
		{ success: true, message: "Comment deleted successfully", data: result },
		httpStatusCodes.OK,
	);
};
