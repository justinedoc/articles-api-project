import { eq } from "drizzle-orm";
import * as httpStatusCodes from "stoker/http-status-codes";
import { cache } from "@/core/cache";
import { db } from "@/core/db";
import { user } from "@/core/db/schema";
import { AppError } from "@/core/errors";
import type { UpdateProfilePayload } from "./schema";

const getUserCacheKey = (userId: string) => `users:${userId}:profile`;

export const getProfile = async (userId: string) => {
	const profile = await cache.getOrSet(
		getUserCacheKey(userId),
		async () => {
			const [record] = await db.select().from(user).where(eq(user.id, userId));
			return record ?? null;
		},
		{
			ttlSeconds: 600, // 10 minutes cache
			jitter: true, // ±10% random jitter to avoid Cache Avalanche
			cacheNull: true, // Negative caching to avoid Cache Penetration
			nullTtlSeconds: 30,
		},
	);

	if (!profile) {
		throw new AppError("User not found", httpStatusCodes.NOT_FOUND);
	}

	return profile;
};

export const updateProfile = async (
	userId: string,
	payload: UpdateProfilePayload,
) => {
	if (Object.keys(payload).length === 0) {
		throw new AppError(
			"No data provided to update",
			httpStatusCodes.BAD_REQUEST,
		);
	}

	const { avatarUrl, ...rest } = payload;

	const [updated] = await db
		.update(user)
		.set({ ...rest, ...(avatarUrl ? { image: avatarUrl } : {}) })
		.where(eq(user.id, userId))
		.returning();

	if (!updated) {
		throw new AppError("User not found", httpStatusCodes.NOT_FOUND);
	}

	// Immediately invalidate stale cache on write
	await cache.del(getUserCacheKey(userId));

	return updated;
};

export const deleteAccount = async (userId: string) => {
	const [deleted] = await db
		.delete(user)
		.where(eq(user.id, userId))
		.returning();

	if (!deleted) {
		throw new AppError("User not found", httpStatusCodes.NOT_FOUND);
	}

	// Immediately invalidate stale cache on delete
	await cache.del(getUserCacheKey(userId));

	return deleted;
};
