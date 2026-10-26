import crypto from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import * as httpStatusCodes from "stoker/http-status-codes";
import { cache } from "@/core/cache";
import { db } from "@/core/db";
import { profile, user } from "@/core/db/schema";
import { AppError } from "@/core/errors";
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
	const sanitized =
		baseString
			.split("@")[0]
			.toLowerCase()
			.replace(/[^a-z0-9_-]/g, "") || "user";

	let candidate = sanitized;
	let attempts = 0;

	while (attempts < 10) {
		const [existing] = await db
			.select({ id: profile.id })
			.from(profile)
			.where(eq(profile.username, candidate));

		if (!existing) return candidate;

		attempts++;
		candidate = `${sanitized}_${crypto.randomBytes(2).toString("hex")}`;
	}

	return `${sanitized}_${Date.now()}`;
}

/**
 * Gets or initializes the author profile for a given user.
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

			const username = await generateUniqueUsername(
				userData.name || userData.email,
			);

			const [newProfile] = await db
				.insert(profile)
				.values({
					id: crypto.randomUUID(),
					userId,
					username,
					displayName: userData.name,
					avatarUrl: userData.image,
					socialLinks: {},
				})
				.returning();

			return newProfile ?? null;
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
			ttlSeconds: 900, // 15 minutes public cache
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

	// Check username collision if updating username
	if (
		payload.username &&
		payload.username.toLowerCase() !== currentProfile.username.toLowerCase()
	) {
		const normalizedNewUsername = payload.username.toLowerCase();
		const [collision] = await db
			.select({ id: profile.id })
			.from(profile)
			.where(
				and(
					eq(profile.username, normalizedNewUsername),
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

	// 1. Sync name & image to user table to avoid desynchronization with Better-Auth sessions
	const userUpdates: { name?: string; image?: string | null } = {};
	if (payload.displayName !== undefined) {
		userUpdates.name = payload.displayName;
	}
	if (payload.avatarUrl !== undefined) {
		userUpdates.image = payload.avatarUrl;
	}

	if (Object.keys(userUpdates).length > 0) {
		await db.update(user).set(userUpdates).where(eq(user.id, userId));
		await cache.del(getAccountCacheKey(userId));
	}

	// 2. Update profile table
	const profileUpdates = {
		...payload,
		...(payload.username ? { username: payload.username.toLowerCase() } : {}),
	};

	const [updated] = await db
		.update(profile)
		.set(profileUpdates)
		.where(eq(profile.userId, userId))
		.returning();

	if (!updated) {
		throw new AppError("Profile not found", httpStatusCodes.NOT_FOUND);
	}

	// 3. Invalidate Redis caches
	await cache.del(getProfileUserCacheKey(userId));
	await cache.del(getProfileUsernameCacheKey(currentProfile.username));
	if (updated.username !== currentProfile.username) {
		await cache.del(getProfileUsernameCacheKey(updated.username));
	}

	return updated;
};
