import * as httpStatusCodes from "stoker/http-status-codes";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cache } from "@/core/cache";
import { db } from "@/core/db";
import { AppError } from "@/core/errors";
import {
	getOrCreateProfile,
	getPublicProfileByUsername,
	updateProfile,
} from "../service";

vi.mock("@/core/cache", () => ({
	cache: {
		getOrSet: vi.fn(),
		del: vi.fn(),
	},
}));

vi.mock("@/core/db", () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		transaction: vi.fn(),
	},
}));

describe("Profiles Service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(db.transaction).mockImplementation(async (callback) =>
			callback({
				select: db.select,
				insert: db.insert,
				update: db.update,
			} as never),
		);
	});

	describe("getOrCreateProfile", () => {
		it("should return the existing profile from cache/db", async () => {
			const mockProfile = {
				id: "prof_1",
				userId: "usr_1",
				username: "alice",
				displayName: "Alice Smith",
				bio: "Author bio",
				avatarUrl: "https://example.com/avatar.jpg",
				bannerUrl: null,
				websiteUrl: null,
				socialLinks: {},
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			vi.mocked(cache.getOrSet).mockImplementation(
				async (_key, fetchFn) => (await fetchFn()) ?? mockProfile,
			);

			const selectMock = {
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockResolvedValue([mockProfile]),
			};
			vi.mocked(db.select).mockReturnValue(
				selectMock as unknown as ReturnType<typeof db.select>,
			);

			const result = await getOrCreateProfile("usr_1");
			expect(result).toEqual(mockProfile);
			expect(cache.getOrSet).toHaveBeenCalledWith(
				"profiles:user:usr_1",
				expect.any(Function),
				expect.objectContaining({ ttlSeconds: 600 }),
			);
		});

		it("should automatically initialize and seed profile from user if profile does not exist", async () => {
			const mockUser = {
				id: "usr_2",
				name: "Bob Jones",
				email: "bob@example.com",
				image: "https://example.com/bob.jpg",
			};

			const createdProfile = {
				id: "prof_2",
				userId: "usr_2",
				username: "bobjones",
				displayName: "Bob Jones",
				bio: null,
				avatarUrl: "https://example.com/bob.jpg",
				bannerUrl: null,
				websiteUrl: null,
				socialLinks: {},
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			vi.mocked(cache.getOrSet).mockImplementation(
				async (_key, fetchFn) => await fetchFn(),
			);

			// First select: profile check (empty)
			// Second select: user check (found)
			// Third select: generateUniqueUsername username collision check (empty)
			let selectCall = 0;
			vi.mocked(db.select).mockImplementation(() => {
				selectCall++;
				if (selectCall === 1) {
					return {
						from: vi.fn().mockReturnThis(),
						where: vi.fn().mockResolvedValue([]),
					} as unknown as ReturnType<typeof db.select>;
				}
				if (selectCall === 2) {
					return {
						from: vi.fn().mockReturnThis(),
						where: vi.fn().mockResolvedValue([mockUser]),
					} as unknown as ReturnType<typeof db.select>;
				}
				return {
					from: vi.fn().mockReturnThis(),
					where: vi.fn().mockResolvedValue([]),
				} as unknown as ReturnType<typeof db.select>;
			});

			const insertMock = {
				values: vi.fn().mockReturnThis(),
				onConflictDoNothing: vi.fn().mockReturnThis(),
				returning: vi.fn().mockResolvedValue([createdProfile]),
			};
			vi.mocked(db.insert).mockReturnValue(
				insertMock as unknown as ReturnType<typeof db.insert>,
			);

			const result = await getOrCreateProfile("usr_2");
			expect(result).toEqual(createdProfile);
			expect(db.insert).toHaveBeenCalled();
		});

		it("should throw 404 AppError if user does not exist", async () => {
			vi.mocked(cache.getOrSet).mockResolvedValue(null);

			await expect(getOrCreateProfile("usr_missing")).rejects.toThrow(
				new AppError("User not found", httpStatusCodes.NOT_FOUND),
			);
		});
	});

	describe("getPublicProfileByUsername", () => {
		it("should return the public profile for an existing author", async () => {
			const mockPublicProfile = {
				id: "prof_1",
				username: "alice",
				displayName: "Alice Smith",
				bio: "Author bio",
				avatarUrl: "https://example.com/avatar.jpg",
				bannerUrl: null,
				websiteUrl: null,
				socialLinks: {},
				createdAt: new Date(),
			};

			vi.mocked(cache.getOrSet).mockImplementation(
				async (_key, fetchFn) => (await fetchFn()) ?? mockPublicProfile,
			);

			const selectMock = {
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockResolvedValue([mockPublicProfile]),
			};
			vi.mocked(db.select).mockReturnValue(
				selectMock as unknown as ReturnType<typeof db.select>,
			);

			const result = await getPublicProfileByUsername("Alice");
			expect(result).toEqual(mockPublicProfile);
			expect(cache.getOrSet).toHaveBeenCalledWith(
				"profiles:username:alice",
				expect.any(Function),
				expect.objectContaining({ ttlSeconds: 900 }),
			);
		});

		it("should throw 404 AppError if author profile is not found", async () => {
			vi.mocked(cache.getOrSet).mockResolvedValue(null);

			await expect(getPublicProfileByUsername("unknown")).rejects.toThrow(
				new AppError("Author profile not found", httpStatusCodes.NOT_FOUND),
			);
		});
	});

	describe("updateProfile", () => {
		it("should throw 400 AppError if payload is empty", async () => {
			await expect(updateProfile("usr_1", {})).rejects.toThrow(
				new AppError("No data provided to update", httpStatusCodes.BAD_REQUEST),
			);
		});

		it("should throw 409 AppError if candidate username is already taken", async () => {
			const existingProfile = {
				id: "prof_1",
				userId: "usr_1",
				username: "alice",
				displayName: "Alice",
			};

			// Mock getOrCreateProfile via cache
			vi.mocked(cache.getOrSet).mockResolvedValue(existingProfile);

			// Mock collision check returning taken
			const selectMock = {
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockResolvedValue([{ id: "prof_other" }]),
			};
			vi.mocked(db.select).mockReturnValue(
				selectMock as unknown as ReturnType<typeof db.select>,
			);

			await expect(
				updateProfile("usr_1", { username: "charlie" }),
			).rejects.toThrow(
				new AppError(
					"Username is already taken by another author",
					httpStatusCodes.CONFLICT,
				),
			);
		});

		it("should update profile and sync displayName and avatarUrl to user table", async () => {
			const existingProfile = {
				id: "prof_1",
				userId: "usr_1",
				username: "alice",
				displayName: "Alice",
				avatarUrl: "https://example.com/old.jpg",
			};

			const updatedProfile = {
				...existingProfile,
				displayName: "Alice Smith",
				avatarUrl: "https://example.com/new.jpg",
				bio: "New bio",
			};

			vi.mocked(cache.getOrSet).mockResolvedValue(existingProfile);

			const userUpdateMock = {
				set: vi.fn().mockReturnThis(),
				where: vi.fn().mockResolvedValue([{ id: "usr_1" }]),
			};
			const profileUpdateMock = {
				set: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				returning: vi.fn().mockResolvedValue([updatedProfile]),
			};

			let updateCall = 0;
			vi.mocked(db.update).mockImplementation(() => {
				updateCall++;
				if (updateCall === 1) {
					return userUpdateMock as unknown as ReturnType<typeof db.update>;
				}
				return profileUpdateMock as unknown as ReturnType<typeof db.update>;
			});

			const result = await updateProfile("usr_1", {
				displayName: "Alice Smith",
				avatarUrl: "https://example.com/new.jpg",
				bio: "New bio",
			});

			expect(result).toEqual(updatedProfile);

			// Verify user table sync occurred!
			expect(userUpdateMock.set).toHaveBeenCalledWith({
				name: "Alice Smith",
				image: "https://example.com/new.jpg",
			});

			// Verify cache invalidation
			expect(cache.del).toHaveBeenCalledWith("profiles:user:usr_1");
			expect(cache.del).toHaveBeenCalledWith("profiles:username:alice");
			expect(cache.del).toHaveBeenCalledWith("account:user:usr_1");
		});
	});
});
