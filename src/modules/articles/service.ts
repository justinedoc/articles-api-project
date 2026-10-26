import { and, eq } from "drizzle-orm";
import * as httpStatusCodes from "stoker/http-status-codes";
import { cache } from "@/core/cache";
import { db } from "@/core/db";
import { article } from "@/core/db/schema";
import { AppError } from "@/core/errors";
import { generateId } from "@/core/utils";
import type {
	ArticleCreatePayload,
	ArticleUpdatePayload,
	SelectArticle,
} from "./schema";

export const getArticleCacheKey = (id: string) => `articles:id:${id}`;

const slugify = (title: string) =>
	title
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 80) || "article";

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

export const createArticle = async (
	authorId: string,
	payload: ArticleCreatePayload,
): Promise<SelectArticle> => {
	const id = generateId();
	const [created] = await db
		.insert(article)
		.values({
			id,
			authorId,
			title: payload.title,
			slug: `${slugify(payload.title)}-${id.slice(0, 8)}`,
			excerpt: payload.excerpt ?? null,
			body: payload.body,
			status: "draft",
			publishedAt: null,
		})
		.returning();

	if (!created) {
		throw new AppError("Article could not be created");
	}
	return created;
};

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

export const getOwnedArticle = async (
	id: string,
	userId: string,
): Promise<SelectArticle> => {
	const record = await getArticleOrThrow(id);
	assertOwner(record, userId);
	return record;
};

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

	const [updated] = await db
		.update(article)
		.set(payload)
		.where(eq(article.id, id))
		.returning();

	if (!updated) {
		throw new AppError("Article not found", httpStatusCodes.NOT_FOUND);
	}
	await cache.del(getArticleCacheKey(id));
	return updated;
};

type ArticleTransition = "published" | "archived";

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
				transition === "published" ? (current.publishedAt ?? new Date()) : null,
		})
		.where(eq(article.id, id))
		.returning();

	if (!updated) {
		throw new AppError("Article not found", httpStatusCodes.NOT_FOUND);
	}
	await cache.del(getArticleCacheKey(id));
	return updated;
};

export const deleteArticle = async (id: string, userId: string) => {
	const current = await getArticleOrThrow(id);
	assertOwner(current, userId);
	await db.delete(article).where(eq(article.id, id));
	await cache.del(getArticleCacheKey(id));
};
