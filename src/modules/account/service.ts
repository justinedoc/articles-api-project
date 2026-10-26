import { eq } from "drizzle-orm";
import * as httpStatusCodes from "stoker/http-status-codes";
import { cache } from "@/core/cache";
import { db } from "@/core/db";
import { profile, user } from "@/core/db/schema";
import { AppError } from "@/core/errors";
import {
	getProfileUserCacheKey,
	getProfileUsernameCacheKey,
} from "@/modules/profiles/service";

export const getAccountCacheKey = (userId: string) => `account:user:${userId}`;

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

export const deleteAccount = async (userId: string) => {
	const { userProfile, deleted } = await db.transaction(async (tx) => {
		const [userProfile] = await tx
			.select({ username: profile.username })
			.from(profile)
			.where(eq(profile.userId, userId));
		const [deleted] = await tx
			.delete(user)
			.where(eq(user.id, userId))
			.returning();

		return { userProfile, deleted };
	});

	if (!deleted) {
		throw new AppError("Account not found", httpStatusCodes.NOT_FOUND);
	}

	// Invalidate account and profile caches
	await Promise.all([
		cache.del(getAccountCacheKey(userId)),
		cache.del(getProfileUserCacheKey(userId)),
		userProfile?.username
			? cache.del(getProfileUsernameCacheKey(userProfile.username))
			: Promise.resolve(),
	]);

	return deleted;
};
