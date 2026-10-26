import { and, eq, gt, or } from "drizzle-orm";
import * as httpStatusCodes from "stoker/http-status-codes";
import { db } from "@/core/db";
import { article, comment } from "@/core/db/schema";
import { AppError } from "@/core/errors";
import { generateId } from "@/core/utils";
import type { CommentCreatePayload, SelectComment } from "./schema";

const encodeCursor = (record: SelectComment) =>
	Buffer.from(`${record.createdAt.toISOString()}|${record.id}`).toString(
		"base64url",
	);

const decodeCursor = (cursor: string) => {
	const decoded = Buffer.from(cursor, "base64url").toString("utf8");
	const separator = decoded.indexOf("|");
	if (separator <= 0) {
		throw new AppError("Invalid comment cursor", httpStatusCodes.BAD_REQUEST);
	}
	const createdAt = new Date(decoded.slice(0, separator));
	const id = decoded.slice(separator + 1);
	if (Number.isNaN(createdAt.getTime()) || !id) {
		throw new AppError("Invalid comment cursor", httpStatusCodes.BAD_REQUEST);
	}
	return { createdAt, id };
};

const assertPublishedArticle = async (articleId: string) => {
	const [record] = await db
		.select({ id: article.id })
		.from(article)
		.where(and(eq(article.id, articleId), eq(article.status, "published")));
	if (!record) {
		throw new AppError("Article not found", httpStatusCodes.NOT_FOUND);
	}
};

export const listComments = async (
	articleId: string,
	cursor: string | undefined,
	limit: number,
) => {
	await assertPublishedArticle(articleId);
	const conditions = [eq(comment.articleId, articleId)];
	if (cursor) {
		const decoded = decodeCursor(cursor);
		conditions.push(
			or(
				gt(comment.createdAt, decoded.createdAt),
				and(
					eq(comment.createdAt, decoded.createdAt),
					gt(comment.id, decoded.id),
				),
			) as never,
		);
	}

	const records = await db
		.select()
		.from(comment)
		.where(and(...conditions))
		.orderBy(comment.createdAt, comment.id)
		.limit(limit + 1);
	const hasNextPage = records.length > limit;
	const data = hasNextPage ? records.slice(0, limit) : records;
	return {
		data,
		nextCursor: hasNextPage ? encodeCursor(data[data.length - 1]) : null,
	};
};

export const createComment = async (
	articleId: string,
	authorId: string,
	payload: CommentCreatePayload,
): Promise<SelectComment> => {
	await assertPublishedArticle(articleId);
	if (payload.parentId) {
		const [parent] = await db
			.select()
			.from(comment)
			.where(
				and(eq(comment.id, payload.parentId), eq(comment.articleId, articleId)),
			);
		if (!parent) {
			throw new AppError("Parent comment not found", httpStatusCodes.NOT_FOUND);
		}
		if (parent.deletedAt) {
			throw new AppError(
				"Cannot reply to a deleted comment",
				httpStatusCodes.CONFLICT,
			);
		}
	}

	const [created] = await db
		.insert(comment)
		.values({
			id: generateId(),
			articleId,
			authorId,
			parentId: payload.parentId ?? null,
			body: payload.body,
		})
		.returning();
	if (!created) throw new AppError("Comment could not be created");
	return created;
};

const getCommentOrThrow = async (commentId: string) => {
	const [record] = await db
		.select()
		.from(comment)
		.where(eq(comment.id, commentId));
	if (!record) {
		throw new AppError("Comment not found", httpStatusCodes.NOT_FOUND);
	}
	return record;
};

export const updateComment = async (
	commentId: string,
	authorId: string,
	body: string,
) => {
	const current = await getCommentOrThrow(commentId);
	if (current.authorId !== authorId) {
		throw new AppError(
			"You do not own this comment",
			httpStatusCodes.FORBIDDEN,
		);
	}
	if (current.deletedAt) {
		throw new AppError(
			"Deleted comments cannot be edited",
			httpStatusCodes.CONFLICT,
		);
	}
	const [updated] = await db
		.update(comment)
		.set({ body })
		.where(eq(comment.id, commentId))
		.returning();
	return updated;
};

export const deleteComment = async (commentId: string, authorId: string) => {
	const current = await getCommentOrThrow(commentId);
	if (current.authorId !== authorId) {
		throw new AppError(
			"You do not own this comment",
			httpStatusCodes.FORBIDDEN,
		);
	}
	if (current.deletedAt) return current;
	const [deleted] = await db
		.update(comment)
		.set({ body: "Comment deleted", deletedAt: new Date() })
		.where(eq(comment.id, commentId))
		.returning();
	return deleted;
};
