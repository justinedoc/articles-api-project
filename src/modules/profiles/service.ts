import crypto from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import * as httpStatusCodes from "stoker/http-status-codes";
import { cache } from "@/core/cache";
import { db } from "@/core/db";
import { profile, user } from "@/core/db/schema";
import { AppError } from "@/core/errors";
import { generateId } from "@/core/utils";
import { getAccountCacheKey } from "@/modules/account/service";
import type {
	PublicProfile,
	SelectProfile,
	UpdateProfilePayload,
} from "./schema";

export const getProfileUserCacheKey = (userId: string) =>
	`profiles:user:${userId}`;
export const getProfileUsernameCacheKey = (username: string) =>
	`profiles:username:${username.toLowerCase()}`;

/**
 * Generates a unique username derived from an email or base string.
 */
export async function generateUniqueUsername(
	baseString: string,
): Promise<string> {
	return (
		baseString
			.split("@")[0]
			.toLowerCase()
			.replace(/[^a-z0-9_-]/g, "") || "user"
	);
}

/**
 * Gets or initializes author profile for a given user.
 * Automatically handles seeding the profile from the auth `user` record.
 */
export const getOrCreateProfile = async (
	userId: string,
): Promise<SelectProfile> => {
	const profileData = await cache.getOrSet(
		getProfileUserCacheKey(userId),
		async () => {
			const [existingProfile] = await db
				.select()
				.from(profile)
				.where(eq(profile.userId, userId));

			if (existingProfile) {
				return existingProfile;
			}

			// If profile does not exist, fetch user to initialize it
			const [userData] = await db
				.select()
				.from(user)
				.where(eq(user.id, userId));

			if (!userData) {
				return null;
			}

			const baseUsername = await generateUniqueUsername(
				userData.name || userData.email,
			);

			for (let attempt = 0; attempt < 10; attempt++) {
				const username =
					attempt === 0
						? baseUsername
						: `${baseUsername}_${crypto.randomBytes(2).toString("hex")}`;
				const [newProfile] = await db
					.insert(profile)
					.values({
						id: generateId(),
						userId,
						username,
						displayName: userData.name,
						avatarUrl: userData.image,
						socialLinks: {},
					})
					.onConflictDoNothing()
					.returning();

				if (newProfile) return newProfile;

				const [existingProfile] = await db
					.select()
					.from(profile)
					.where(eq(profile.userId, userId));
				if (existingProfile) return existingProfile;
			}

			return null;
		},
		{
			ttlSeconds: 600,
			jitter: true,
			cacheNull: true,
			nullTtlSeconds: 30,
		},
	);

	if (!profileData) {
		throw new AppError("User not found", httpStatusCodes.NOT_FOUND);
	}

	return profileData;
};

/**
 * Retrieves a public author profile by unique username.
 * Cached in Redis for fast access.
 */
export const getPublicProfileByUsername = async (
	username: string,
): Promise<PublicProfile> => {
	const normalizedUsername = username.toLowerCase();

	const authorProfile = await cache.getOrSet(
		getProfileUsernameCacheKey(normalizedUsername),
		async () => {
			const [record] = await db
				.select({
					id: profile.id,
					username: profile.username,
					displayName: profile.displayName,
					bio: profile.bio,
					avatarUrl: profile.avatarUrl,
					bannerUrl: profile.bannerUrl,
					websiteUrl: profile.websiteUrl,
					socialLinks: profile.socialLinks,
					createdAt: profile.createdAt,
				})
				.from(profile)
				.where(eq(profile.username, normalizedUsername));

			return record ?? null;
		},
		{
			ttlSeconds: 900, // 15 mins cache
			jitter: true,
			cacheNull: true,
			nullTtlSeconds: 60,
		},
	);

	if (!authorProfile) {
		throw new AppError("Author profile not found", httpStatusCodes.NOT_FOUND);
	}

	return authorProfile;
};

/**
 * Updates the author's profile.
 * Automatically synchronizes displayName -> user.name and avatarUrl -> user.image
 * to ensure Better-Auth sessions and profile data remain completely in sync.
 */
export const updateProfile = async (
	userId: string,
	payload: UpdateProfilePayload,
): Promise<SelectProfile> => {
	if (Object.keys(payload).length === 0) {
		throw new AppError(
			"No data provided to update",
			httpStatusCodes.BAD_REQUEST,
		);
	}

	// Ensure profile exists first
	const currentProfile = await getOrCreateProfile(userId);

	const userUpdates: { name?: string; image?: string | null } = {};
	if (payload.displayName !== undefined) {
		userUpdates.name = payload.displayName;
	}
	if (payload.avatarUrl !== undefined) {
		userUpdates.image = payload.avatarUrl;
	}

	const profileUpdates = {
		...payload,
		...(payload.username ? { username: payload.username.toLowerCase() } : {}),
	};

	const updated = await db.transaction(async (tx) => {
		if (
			payload.username &&
			payload.username.toLowerCase() !== currentProfile.username.toLowerCase()
		) {
			const [collision] = await tx
				.select({ id: profile.id })
				.from(profile)
				.where(
					and(
						eq(profile.username, payload.username.toLowerCase()),
						ne(profile.userId, userId),
					),
				);

			if (collision) {
				throw new AppError(
					"Username is already taken by another author",
					httpStatusCodes.CONFLICT,
				);
			}
		}

		if (Object.keys(userUpdates).length > 0) {
			await tx.update(user).set(userUpdates).where(eq(user.id, userId));
		}

		const [updatedProfile] = await tx
			.update(profile)
			.set(profileUpdates)
			.where(eq(profile.userId, userId))
			.returning();

		return updatedProfile;
	});

	if (!updated) {
		throw new AppError("Profile not found", httpStatusCodes.NOT_FOUND);
	}

	await Promise.all([
		Object.keys(userUpdates).length > 0
			? cache.del(getAccountCacheKey(userId))
			: Promise.resolve(),
		cache.del(getProfileUserCacheKey(userId)),
		cache.del(getProfileUsernameCacheKey(currentProfile.username)),
		updated.username !== currentProfile.username
			? cache.del(getProfileUsernameCacheKey(updated.username))
			: Promise.resolve(),
	]);

	return updated;
};
