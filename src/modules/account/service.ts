import { eq } from "drizzle-orm";
import * as httpStatusCodes from "stoker/http-status-codes";
import { cache } from "@/core/cache";
import { db } from "@/core/db";
import { profile, user } from "@/core/db/schema";
import { AppError } from "@/core/errors";

export const getAccountCacheKey = (userId: string) => `account:user:${userId}`;

export const getAccount = async (userId: string) => {
	const accountData = await cache.getOrSet(
		getAccountCacheKey(userId),
		async () => {
			const [record] = await db.select().from(user).where(eq(user.id, userId));
			return record ?? null;
		},
		{
			ttlSeconds: 600, // 10 minutes cache
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
	const [[userProfile], [deleted]] = await Promise.all([
		db
			.select({ username: profile.username })
			.from(profile)
			.where(eq(profile.userId, userId)),

		db.delete(user).where(eq(user.id, userId)).returning(),
	]);

	if (!deleted) {
		throw new AppError("Account not found", httpStatusCodes.NOT_FOUND);
	}

	// Invalidate both account and profile caches
	await cache.del(getAccountCacheKey(userId));
	await cache.del(`profiles:user:${userId}`);
	if (userProfile?.username) {
		await cache.del(`profiles:username:${userProfile.username}`);
	}

	return deleted;
};
