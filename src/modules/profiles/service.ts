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
	const cleaned = baseString
		.split("@")[0]
		.toLowerCase()
		.replace(/[^a-z0-9_-]/g, "");

	if (cleaned.length < 3) {
		return `user_${cleaned || crypto.randomBytes(2).toString("hex")}`;
	}

	return cleaned.slice(0, 20);
}

/**
 * Retrieves the author profile for a given user by their user ID.
 * Pure query - reads composite profile (joined with user table) and caches in Redis.
 */
export const getProfileByUserId = async (
	userId: string,
): Promise<SelectProfile | null> => {
	const profileData = await cache.getOrSet(
		getProfileUserCacheKey(userId),
		async () => {
			const [existingProfile] = await db
				.select({
					id: profile.id,
					userId: profile.userId,
					username: profile.username,
					displayName: user.name,
					bio: profile.bio,
					avatarUrl: user.image,
					bannerUrl: profile.bannerUrl,
					websiteUrl: profile.websiteUrl,
					socialLinks: profile.socialLinks,
					createdAt: profile.createdAt,
					updatedAt: profile.updatedAt,
				})
				.from(profile)
				.innerJoin(user, eq(user.id, profile.userId))
				.where(eq(profile.userId, userId));

			return existingProfile ?? null;
		},
		{
			ttlSeconds: 600,
			jitter: true,
			cacheNull: true,
			nullTtlSeconds: 30,
		},
	);

	return profileData;
};

/**
 * Creates an author profile for a user.
 * Explicit write command - derives handle, inserts profile record, and primes caches.
 */
export const createProfile = async (
	userId: string,
	initialUsername?: string,
): Promise<SelectProfile> => {
	// Verify user exists
	const [userData] = await db.select().from(user).where(eq(user.id, userId));

	if (!userData) {
		throw new AppError("User not found", httpStatusCodes.NOT_FOUND);
	}

	const baseUsername = initialUsername
		? initialUsername
				.toLowerCase()
				.replace(/[^a-z0-9_-]/g, "")
				.slice(0, 20)
		: await generateUniqueUsername(userData.name || userData.email);

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
				socialLinks: {},
			})
			.onConflictDoNothing()
			.returning();

		if (newProfile) {
			const created: SelectProfile = {
				...newProfile,
				displayName: userData.name,
				avatarUrl: userData.image,
			};

			// Invalidate cache so subsequent gets immediately hit
			await Promise.all([
				cache.del(getProfileUserCacheKey(userId)),
				cache.del(getProfileUsernameCacheKey(created.username)),
			]);

			return created;
		}

		// If profile already exists (conflict on userId or concurrent creation)
		const existing = await getProfileByUserId(userId);
		if (existing) {
			return existing;
		}
	}

	throw new AppError(
		"Unable to generate unique author handle",
		httpStatusCodes.CONFLICT,
	);
};

/**
 * Gets author profile, or initializes it if not yet created.
 * Acts as a resilient fallback facade for authenticated user profile retrieval.
 */
export const getOrCreateProfile = async (
	userId: string,
): Promise<SelectProfile> => {
	const existing = await getProfileByUserId(userId);
	if (existing) {
		return existing;
	}

	return createProfile(userId);
};

/**
 * Retrieves a public author profile by unique username.
 * Cached
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
					displayName: user.name,
					bio: profile.bio,
					avatarUrl: user.image,
					bannerUrl: profile.bannerUrl,
					websiteUrl: profile.websiteUrl,
					socialLinks: profile.socialLinks,
					createdAt: profile.createdAt,
				})
				.from(profile)
				.innerJoin(user, eq(user.id, profile.userId))
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

	const {
		displayName,
		avatarUrl,
		username: rawUsername,
		...authorMetadata
	} = payload;
	const userUpdates: { name?: string; image?: string | null } = {};
	if (displayName !== undefined) {
		userUpdates.name = displayName;
	}
	if (avatarUrl !== undefined) {
		userUpdates.image = avatarUrl;
	}

	const profileUpdates = {
		...authorMetadata,
		...(rawUsername ? { username: rawUsername.toLowerCase() } : {}),
	};

	try {
		const updated = await db.transaction(async (tx) => {
			if (
				rawUsername &&
				rawUsername.toLowerCase() !== currentProfile.username.toLowerCase()
			) {
				const [collision] = await tx
					.select({ id: profile.id })
					.from(profile)
					.where(
						and(
							eq(profile.username, rawUsername.toLowerCase()),
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

			let updatedUserName = currentProfile.displayName;
			let updatedUserImage = currentProfile.avatarUrl;

			if (Object.keys(userUpdates).length > 0) {
				const [updatedUser] = await tx
					.update(user)
					.set(userUpdates)
					.where(eq(user.id, userId))
					.returning();
				if (updatedUser) {
					updatedUserName = updatedUser.name;
					updatedUserImage = updatedUser.image;
				}
			}

			let updatedProfileRecord = currentProfile;
			if (Object.keys(profileUpdates).length > 0) {
				const [p] = await tx
					.update(profile)
					.set(profileUpdates)
					.where(eq(profile.userId, userId))
					.returning();
				if (p) {
					updatedProfileRecord = {
						...p,
						displayName: updatedUserName,
						avatarUrl: updatedUserImage,
					};
				}
			} else {
				updatedProfileRecord = {
					...currentProfile,
					displayName: updatedUserName,
					avatarUrl: updatedUserImage,
				};
			}

			return updatedProfileRecord;
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
	} catch (err: unknown) {
		if (err instanceof AppError) {
			throw err;
		}
		if (
			typeof err === "object" &&
			err !== null &&
			"code" in err &&
			err.code === "23505"
		) {
			throw new AppError(
				"Username is already taken by another author",
				httpStatusCodes.CONFLICT,
			);
		}
		throw err;
	}
};
