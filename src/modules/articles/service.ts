import { and, count, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import * as httpStatusCodes from "stoker/http-status-codes";
import { cache } from "@/core/cache";
import { db } from "@/core/db";
import {
	article,
	articleLike,
	articleTag,
	comment,
	tag,
} from "@/core/db/schema";
import { AppError } from "@/core/errors";
import { decodeCursor, encodeCursor } from "@/core/pagination";
import { generateId } from "@/core/utils";
import type {
	ArticleCreatePayload,
	ArticleUpdatePayload,
	SelectArticle,
	TrendingArticle,
} from "./schema";

export const getArticleCacheKey = (id: string) => `articles:id:${id}`;
export const getArticleLikesCountKey = (id: string) =>
	`article:likes_count:${id}`;
export const getTrendingArticlesKey = (limit: number) =>
	`articles:trending:${limit}`;

const slugify = (title: string) =>
	title
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 80) || "article";

const normalizeTags = (tags: string[] | undefined) => [
	...new Set((tags ?? []).map((value) => value.trim().toLowerCase())),
];

type DatabaseExecutor =
	| typeof db
	| Parameters<Parameters<typeof db.transaction>[0]>[0];

const syncArticleTags = async (
	tx: DatabaseExecutor,
	articleId: string,
	names: string[],
) => {
	await tx.delete(articleTag).where(eq(articleTag.articleId, articleId));
	if (names.length === 0) return;

	const tagRecords = await tx
		.insert(tag)
		.values(names.map((name) => ({ name })))
		.onConflictDoUpdate({
			target: tag.name,
			set: { name: sql`excluded.name` },
		})
		.returning();

	await tx.insert(articleTag).values(
		tagRecords.map((t) => ({
			articleId,
			tagId: t.id,
		})),
	);
};

const getArticleOrThrow = async (id: string) => {
	const [record] = await db.select().from(article).where(eq(article.id, id));
	if (!record) {
		throw new AppError("Article not found", httpStatusCodes.NOT_FOUND);
	}
	return record;
};

const assertOwner = (record: SelectArticle, userId: string) => {
	if (record.authorId !== userId) {
		throw new AppError(
			"You do not own this article",
			httpStatusCodes.FORBIDDEN,
		);
	}
};

const assertPublished = async (articleId: string) => {
	const [record] = await db
		.select({ id: article.id })
		.from(article)
		.where(and(eq(article.id, articleId), eq(article.status, "published")));
	if (!record) {
		throw new AppError("Article not found", httpStatusCodes.NOT_FOUND);
	}
};

/**
 * gets the total like count for an article, backed by Redis and PostgreSQL.
 */
export const getArticleLikesCount = async (
	articleId: string,
): Promise<number> => {
	const key = getArticleLikesCountKey(articleId);
	const raw = await cache.getRaw(key);
	if (raw !== null) {
		const parsed = Number.parseInt(raw, 10);
		if (!Number.isNaN(parsed)) return parsed;
	}

	// Cache miss: query PostgreSQL (SSOT)
	const [record] = await db
		.select({ count: count() })
		.from(articleLike)
		.where(eq(articleLike.articleId, articleId));

	const total = Number(record?.count ?? 0);
	await cache.set(key, total, { ttlSeconds: 3600 });
	return total;
};

const getLikeResult = async (articleId: string, userId: string) => {
	const [totalCount, userLike] = await Promise.all([
		getArticleLikesCount(articleId),
		db
			.select({ id: articleLike.userId })
			.from(articleLike)
			.where(
				and(
					eq(articleLike.articleId, articleId),
					eq(articleLike.userId, userId),
				),
			)
			.limit(1),
	]);

	return { count: totalCount, liked: userLike.length > 0 };
};

/**
 * creates a new draft article and associates any provided tags.
 */
export const createArticle = async (
	authorId: string,
	payload: ArticleCreatePayload,
): Promise<SelectArticle> => {
	const id = generateId();
	const values = {
		id,
		authorId,
		title: payload.title,
		slug: `${slugify(payload.title)}-${id.slice(0, 8)}`,
		excerpt: payload.excerpt ?? null,
		body: payload.body,
		status: "draft" as const,
		publishedAt: null,
	};
	const names = normalizeTags(payload.tags);
	const [created] =
		names.length > 0
			? [
					await db.transaction(async (transaction) => {
						const [record] = await transaction
							.insert(article)
							.values(values)
							.returning();
						if (!record) throw new AppError("Article could not be created");
						await syncArticleTags(transaction, id, names);
						return record;
					}),
				]
			: await db.insert(article).values(values).returning();

	if (!created) {
		throw new AppError("Article could not be created");
	}
	return created;
};

/**
 * retrieves a published article by id, using redis cache.
 */
export const getPublicArticle = async (id: string): Promise<SelectArticle> => {
	const record = await cache.getOrSet(
		getArticleCacheKey(id),
		async () => {
			const [published] = await db
				.select()
				.from(article)
				.where(and(eq(article.id, id), eq(article.status, "published")));
			return published ?? null;
		},
		{ ttlSeconds: 300, jitter: true, cacheNull: true, nullTtlSeconds: 30 },
	);

	if (!record) {
		throw new AppError("Article not found", httpStatusCodes.NOT_FOUND);
	}
	return record;
};

/**
 * retrieves curated trending articles based on engagement in the last 30 days.
 * cached in redis with single-flight mutex protection.
 */
export const getTrendingArticles = async (
	limit = 10,
): Promise<TrendingArticle[]> => {
	const key = getTrendingArticlesKey(limit);

	const cached = await cache.getOrSet(
		key,
		async () => {
			const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

			const rows = await db
				.select({
					id: article.id,
					authorId: article.authorId,
					title: article.title,
					slug: article.slug,
					excerpt: article.excerpt,
					body: article.body,
					status: article.status,
					publishedAt: article.publishedAt,
					createdAt: article.createdAt,
					updatedAt: article.updatedAt,
					likeCount: sql<number>`COUNT(DISTINCT ${articleLike.userId})::int`,
					commentCount: sql<number>`COUNT(DISTINCT ${comment.id})::int`,
					engagementScore: sql<number>`(COUNT(DISTINCT ${articleLike.userId}) * 2 + COUNT(DISTINCT ${comment.id}))::int`,
				})
				.from(article)
				.leftJoin(articleLike, eq(articleLike.articleId, article.id))
				.leftJoin(
					comment,
					and(eq(comment.articleId, article.id), isNull(comment.deletedAt)),
				)
				.where(
					and(
						eq(article.status, "published"),
						gt(article.publishedAt, thirtyDaysAgo),
					),
				)
				.groupBy(article.id)
				.orderBy(
					sql`(COUNT(DISTINCT ${articleLike.userId}) * 2 + COUNT(DISTINCT ${comment.id})) DESC`,
					desc(article.publishedAt),
				)
				.limit(limit);

			return rows.map((r) => ({
				...r,
				likeCount: Number(r.likeCount || 0),
				commentCount: Number(r.commentCount || 0),
				engagementScore: Number(r.engagementScore || 0),
			}));
		},
		{ ttlSeconds: 300, jitter: true },
	);

	return cached ?? [];
};

/**
 * adds a like to a published article for the user.
 */
export const likeArticle = async (articleId: string, userId: string) => {
	await assertPublished(articleId);
	const inserted = await db
		.insert(articleLike)
		.values({ articleId, userId })
		.onConflictDoNothing()
		.returning({ userId: articleLike.userId });

	const key = getArticleLikesCountKey(articleId);
	if (inserted.length > 0) {
		const cached = await cache.getRaw(key);
		if (cached !== null) {
			await cache.incr(key);
		} else {
			await getArticleLikesCount(articleId);
		}
	}

	return getLikeResult(articleId, userId);
};

/**
 * removes a like from a published article for the user.
 */
export const unlikeArticle = async (articleId: string, userId: string) => {
	await assertPublished(articleId);
	const deleted = await db
		.delete(articleLike)
		.where(
			and(eq(articleLike.articleId, articleId), eq(articleLike.userId, userId)),
		)
		.returning({ userId: articleLike.userId });

	const key = getArticleLikesCountKey(articleId);
	if (deleted.length > 0) {
		const cached = await cache.getRaw(key);
		if (cached !== null) {
			await cache.decr(key);
		} else {
			await getArticleLikesCount(articleId);
		}
	}

	return getLikeResult(articleId, userId);
};

/**
 * lists published articles with optional tag filtering, search, and cursor pagination.
 */
export const listPublicArticles = async (
	cursor: string | undefined,
	limit: number,
	tagName?: string,
	searchTerm?: string,
) => {
	const conditions = [eq(article.status, "published")];
	const normalizedTag = tagName?.trim().toLowerCase();
	const normalizedSearch = searchTerm?.trim();
	if (normalizedSearch) {
		conditions.push(
			sql`to_tsvector('english', ${article.title} || ' ' || ${article.body}) @@ plainto_tsquery('english', ${normalizedSearch})` as never,
		);
	}
	if (cursor) {
		const decoded = decodeCursor(cursor);
		conditions.push(
			or(
				lt(article.publishedAt, decoded.createdAt),
				and(
					eq(article.publishedAt, decoded.createdAt),
					lt(article.id, decoded.id),
				),
			) as never,
		);
	}

	const records = normalizedTag
		? (
				await db
					.select({ article })
					.from(article)
					.innerJoin(articleTag, eq(articleTag.articleId, article.id))
					.innerJoin(
						tag,
						and(eq(tag.id, articleTag.tagId), eq(tag.name, normalizedTag)),
					)
					.where(and(...conditions))
					.orderBy(desc(article.publishedAt), desc(article.id))
					.limit(limit + 1)
			).map((record) => record.article)
		: await db
				.select()
				.from(article)
				.where(and(...conditions))
				.orderBy(desc(article.publishedAt), desc(article.id))
				.limit(limit + 1);

	const hasNextPage = records.length > limit;
	const data = hasNextPage ? records.slice(0, limit) : records;
	const last = data[data.length - 1];

	return {
		data,
		nextCursor:
			hasNextPage && last
				? encodeCursor({
						createdAt: last.publishedAt ?? last.createdAt,
						id: last.id,
					})
				: null,
	};
};

/**
 * lists articles owned by an author with optional status filter, tag, search, and cursor pagination.
 */
export const listOwnedArticles = async (
	userId: string,
	cursor: string | undefined,
	limit: number,
	status?: "draft" | "published" | "archived",
	tagName?: string,
	searchTerm?: string,
) => {
	const conditions = [eq(article.authorId, userId)];
	if (status) {
		conditions.push(eq(article.status, status));
	}
	const normalizedTag = tagName?.trim().toLowerCase();
	const normalizedSearch = searchTerm?.trim();
	if (normalizedSearch) {
		conditions.push(
			sql`to_tsvector('english', ${article.title} || ' ' || ${article.body}) @@ plainto_tsquery('english', ${normalizedSearch})` as never,
		);
	}
	if (cursor) {
		const decoded = decodeCursor(cursor);
		conditions.push(
			or(
				lt(article.createdAt, decoded.createdAt),
				and(
					eq(article.createdAt, decoded.createdAt),
					lt(article.id, decoded.id),
				),
			) as never,
		);
	}

	const records = normalizedTag
		? (
				await db
					.select({ article })
					.from(article)
					.innerJoin(articleTag, eq(articleTag.articleId, article.id))
					.innerJoin(
						tag,
						and(eq(tag.id, articleTag.tagId), eq(tag.name, normalizedTag)),
					)
					.where(and(...conditions))
					.orderBy(desc(article.createdAt), desc(article.id))
					.limit(limit + 1)
			).map((record) => record.article)
		: await db
				.select()
				.from(article)
				.where(and(...conditions))
				.orderBy(desc(article.createdAt), desc(article.id))
				.limit(limit + 1);

	const hasNextPage = records.length > limit;
	const data = hasNextPage ? records.slice(0, limit) : records;
	const last = data[data.length - 1];

	return {
		data,
		nextCursor:
			hasNextPage && last
				? encodeCursor({
						createdAt: last.createdAt,
						id: last.id,
					})
				: null,
	};
};

/**
 * retrieves an article verifying the requesting user is the author.
 */
export const getOwnedArticle = async (
	id: string,
	userId: string,
): Promise<SelectArticle> => {
	const record = await getArticleOrThrow(id);
	assertOwner(record, userId);
	return record;
};

/**
 * updates an owned article and syncs its tags and cache.
 */
export const updateArticle = async (
	id: string,
	userId: string,
	payload: ArticleUpdatePayload,
): Promise<SelectArticle> => {
	if (Object.keys(payload).length === 0) {
		throw new AppError(
			"No data provided to update",
			httpStatusCodes.BAD_REQUEST,
		);
	}

	const current = await getArticleOrThrow(id);
	assertOwner(current, userId);
	const { tags: requestedTags, ...articlePayload } = payload;
	const hasFieldUpdates = Object.keys(articlePayload).length > 0;
	const updateValues = {
		...articlePayload,
		updatedAt: new Date(),
	};

	const updated =
		requestedTags !== undefined
			? await db.transaction(async (transaction) => {
					const [record] = await transaction
						.update(article)
						.set(updateValues)
						.where(eq(article.id, id))
						.returning();
					if (record) {
						await syncArticleTags(
							transaction,
							id,
							normalizeTags(requestedTags),
						);
					}
					return record;
				})
			: hasFieldUpdates
				? (
						await db
							.update(article)
							.set(updateValues)
							.where(eq(article.id, id))
							.returning()
					)[0]
				: current;

	if (!updated) {
		throw new AppError("Article not found", httpStatusCodes.NOT_FOUND);
	}
	await cache.del(getArticleCacheKey(id));
	return updated;
};

type ArticleTransition = "published" | "archived";

/**
 * transitions article status between draft, published, and archived.
 */
export const transitionArticle = async (
	id: string,
	userId: string,
	transition: ArticleTransition,
): Promise<SelectArticle> => {
	const current = await getArticleOrThrow(id);
	assertOwner(current, userId);

	const valid =
		transition === "published"
			? current.status === "draft" || current.status === "archived"
			: current.status === "published";
	if (!valid) {
		throw new AppError(
			`Cannot transition article from ${current.status} to ${transition}`,
			httpStatusCodes.CONFLICT,
		);
	}

	const [updated] = await db
		.update(article)
		.set({
			status: transition,
			publishedAt:
				transition === "published"
					? (current.publishedAt ?? new Date())
					: current.publishedAt,
			updatedAt: new Date(),
		})
		.where(eq(article.id, id))
		.returning();

	if (!updated) {
		throw new AppError("Article not found", httpStatusCodes.NOT_FOUND);
	}
	await Promise.all([
		cache.del(getArticleCacheKey(id)),
		cache.invalidatePattern("articles:trending:*"),
		cache.invalidatePattern("tags:popular:*"),
	]);
	return updated;
};

/**
 * deletes an owned article and invalidates its cache.
 */
export const deleteArticle = async (id: string, userId: string) => {
	const current = await getArticleOrThrow(id);
	assertOwner(current, userId);
	await db.delete(article).where(eq(article.id, id));
	await Promise.all([
		cache.del(getArticleCacheKey(id)),
		cache.del(getArticleLikesCountKey(id)),
		cache.invalidatePattern("articles:trending:*"),
		cache.invalidatePattern("tags:popular:*"),
	]);
};
