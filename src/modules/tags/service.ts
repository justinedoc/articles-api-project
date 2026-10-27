import { and, desc, eq, sql } from "drizzle-orm";
import { cache } from "@/core/cache";
import { db } from "@/core/db";
import { article, articleTag, tag } from "@/core/db/schema";
import type { TagItem } from "./schema";

export const getPopularTagsCacheKey = (limit: number) =>
	`tags:popular:${limit}`;

/**
 * lists popular tags with their published article counts, cached in redis for 1 hour.
 */
export const listPopularTags = async (limit = 20): Promise<TagItem[]> => {
	const key = getPopularTagsCacheKey(limit);

	const cached = await cache.getOrSet(
		key,
		async () => {
			const rows = await db
				.select({
					id: tag.id,
					name: tag.name,
					articleCount: sql<number>`COUNT(${articleTag.articleId})::int`,
				})
				.from(tag)
				.innerJoin(articleTag, eq(articleTag.tagId, tag.id))
				.innerJoin(
					article,
					and(
						eq(article.id, articleTag.articleId),
						eq(article.status, "published"),
					),
				)
				.groupBy(tag.id, tag.name)
				.orderBy(desc(sql`COUNT(${articleTag.articleId})`), tag.name)
				.limit(limit);

			return rows.map((r) => ({
				id: r.id,
				name: r.name,
				articleCount: Number(r.articleCount || 0),
			}));
		},
		{ ttlSeconds: 3600, jitter: true },
	);

	return cached ?? [];
};
