import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import * as httpStatusCodes from "stoker/http-status-codes";
import { cache } from "@/core/cache";
import { db } from "@/core/db";
import { article, comment } from "@/core/db/schema";
import { AppError } from "@/core/errors";
import { decodeCursor, encodeCursor } from "@/core/pagination";
import { generateId } from "@/core/utils";
import { getArticleCacheKey } from "@/modules/articles/service";
import type {
	CommentCreatePayload,
	CommentItem,
	CommentTreeNode,
	SelectComment,
} from "./schema";

const assertPublishedArticle = async (articleId: string) => {
	const [record] = await db
		.select({ id: article.id })
		.from(article)
		.where(and(eq(article.id, articleId), eq(article.status, "published")));
	if (!record) {
		throw new AppError("Article not found", httpStatusCodes.NOT_FOUND);
	}
};

const replyCountSql = sql<number>`(
	SELECT COUNT(*)::int
	FROM "comment" AS "replies"
	WHERE "replies"."parent_id" = "comment"."id"
)`;

/**
 * builds a recursive comment tree from flat items.
 */
export function buildCommentTree(
	items: CommentItem[],
	rootParentId: string | null = null,
): CommentTreeNode[] {
	const map = new Map<string, CommentTreeNode>();
	const roots: CommentTreeNode[] = [];

	for (const item of items) {
		map.set(item.id, { ...item, replies: [] });
	}

	for (const item of items) {
		const node = map.get(item.id);
		if (!node) continue;

		if (item.parentId && item.parentId !== rootParentId) {
			const parent = map.get(item.parentId);
			if (parent?.replies) {
				parent.replies.push(node);
				continue;
			}
		}
		roots.push(node);
	}

	return roots;
}

/**
 * lists paginated root comments for a published article with reply counts.
 */
export const listComments = async (
	articleId: string,
	cursor: string | undefined,
	limit: number,
) => {
	await assertPublishedArticle(articleId);
	const conditions = [
		eq(comment.articleId, articleId),
		isNull(comment.parentId),
	];
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
		.select({
			id: comment.id,
			articleId: comment.articleId,
			authorId: comment.authorId,
			parentId: comment.parentId,
			body: comment.body,
			deletedAt: comment.deletedAt,
			createdAt: comment.createdAt,
			updatedAt: comment.updatedAt,
			replyCount: replyCountSql,
		})
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

/**
 * loads replies for a comment on demand with pagination or recursive tree.
 */
export const listCommentReplies = async (
	commentId: string,
	cursor: string | undefined,
	limit: number,
	tree = false,
): Promise<{ data: CommentTreeNode[]; nextCursor: string | null }> => {
	await getCommentOrThrow(commentId);

	if (tree) {
		const treeRecords = await db.execute<{
			id: string;
			article_id: string;
			author_id: string;
			parent_id: string | null;
			body: string;
			deleted_at: string | null;
			created_at: string;
			updated_at: string;
			reply_count: number;
		}>(sql`
			WITH RECURSIVE descendants AS (
				SELECT
					c.*,
					(SELECT COUNT(*)::int FROM "comment" r WHERE r.parent_id = c.id) AS reply_count
				FROM "comment" c
				WHERE c.parent_id = ${commentId}

				UNION ALL

				SELECT
					c.*,
					(SELECT COUNT(*)::int FROM "comment" r WHERE r.parent_id = c.id) AS reply_count
				FROM "comment" c
				INNER JOIN descendants d ON c.parent_id = d.id
			)
			SELECT * FROM descendants ORDER BY created_at ASC, id ASC
		`);

		const flat: CommentItem[] = (treeRecords.rows || []).map((row) => ({
			id: row.id,
			articleId: row.article_id,
			authorId: row.author_id,
			parentId: row.parent_id,
			body: row.body,
			deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
			createdAt: new Date(row.created_at),
			updatedAt: new Date(row.updated_at),
			replyCount: Number(row.reply_count || 0),
		}));

		const treeData = buildCommentTree(flat, commentId);

		return {
			data: treeData,
			nextCursor: null,
		};
	}

	const conditions = [eq(comment.parentId, commentId)];
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
		.select({
			id: comment.id,
			articleId: comment.articleId,
			authorId: comment.authorId,
			parentId: comment.parentId,
			body: comment.body,
			deletedAt: comment.deletedAt,
			createdAt: comment.createdAt,
			updatedAt: comment.updatedAt,
			replyCount: replyCountSql,
		})
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

/**
 * creates a comment or reply under a published article.
 */
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
	await Promise.all([
		cache.del(getArticleCacheKey(articleId)),
		cache.invalidatePattern("articles:trending:*"),
	]);
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

/**
 * updates the body of an authored comment.
 */
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

/**
 * soft-deletes an authored comment.
 */
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
	await Promise.all([
		cache.del(getArticleCacheKey(current.articleId)),
		cache.invalidatePattern("articles:trending:*"),
	]);
	return deleted;
};
