import { eq } from "drizzle-orm";
import * as httpStatusCodes from "stoker/http-status-codes";
import { cache } from "@/core/cache";
import { db } from "@/core/db";
import { article, profile, user } from "@/core/db/schema";
import { AppError } from "@/core/errors";
import {
	getArticleCacheKey,
	getArticleLikesCountKey,
} from "@/modules/articles/service";
import {
	getProfileUserCacheKey,
	getProfileUsernameCacheKey,
} from "@/modules/profiles/service";

export const getAccountCacheKey = (userId: string) => `account:user:${userId}`;

/**
 * retrieves the authenticated user's account details.
 */
export const getAccount = async (userId: string) => {
	const accountData = await cache.getOrSet(
		getAccountCacheKey(userId),
		async () => {
			const [record] = await db.select().from(user).where(eq(user.id, userId));
			return record ?? null;
		},
		{
			ttlSeconds: 600, // 10 mins
			jitter: true,
			cacheNull: true,
			nullTtlSeconds: 30,
		},
	);

	if (!accountData) {
		throw new AppError("Account not found", httpStatusCodes.NOT_FOUND);
	}

	return accountData;
};

/**
 * deletes a user account and cascades cache invalidation across profiles and articles.
 */
export const deleteAccount = async (userId: string) => {
	const { userProfile, userArticles, deleted } = await db.transaction(
		async (tx) => {
			const [userProfile] = await tx
				.select({ username: profile.username })
				.from(profile)
				.where(eq(profile.userId, userId));
			const userArticles = await tx
				.select({ id: article.id })
				.from(article)
				.where(eq(article.authorId, userId));
			const [deleted] = await tx
				.delete(user)
				.where(eq(user.id, userId))
				.returning();

			return { userProfile, userArticles, deleted };
		},
	);

	if (!deleted) {
		throw new AppError("Account not found", httpStatusCodes.NOT_FOUND);
	}

	// Invalidate account, profile, and article caches
	await Promise.all([
		cache.del(getAccountCacheKey(userId)),
		cache.del(getProfileUserCacheKey(userId)),
		userProfile?.username
			? cache.del(getProfileUsernameCacheKey(userProfile.username))
			: Promise.resolve(),
		...userArticles.flatMap((a) => [
			cache.del(getArticleCacheKey(a.id)),
			cache.del(getArticleLikesCountKey(a.id)),
		]),
		cache.invalidatePattern("articles:trending:*"),
		cache.invalidatePattern("tags:popular:*"),
	]);

	return deleted;
};
