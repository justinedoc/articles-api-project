import * as httpStatusCodes from "stoker/http-status-codes";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cache } from "@/core/cache";
import { db } from "@/core/db";
import { AppError } from "@/core/errors";
import { deleteAccount, getProfile, updateProfile } from "../service";

vi.mock("@/core/cache", () => ({
	cache: {
		getOrSet: vi.fn(),
		del: vi.fn(),
	},
}));

vi.mock("@/core/db", () => ({
	db: {
		select: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
}));

describe("Users Service Unit Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getProfile", () => {
		it("should return the user profile from cache/db", async () => {
			const mockUser = {
				id: "usr_1",
				name: "Alice",
				email: "alice@example.com",
				image: "https://example.com/avatar.jpg",
			};

			vi.mocked(cache.getOrSet).mockImplementation(
				async (_key, fetchFn) =>
					// Simulate cache executing fetchFn or returning data
					(await fetchFn()) ?? mockUser,
			);

			const selectMock = {
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockResolvedValue([mockUser]),
			};
			vi.mocked(db.select).mockReturnValue(
				selectMock as unknown as ReturnType<typeof db.select>,
			);

			const profile = await getProfile("usr_1");
			expect(profile).toEqual(mockUser);
			expect(cache.getOrSet).toHaveBeenCalledWith(
				"users:usr_1:profile",
				expect.any(Function),
				expect.objectContaining({ ttlSeconds: 600 }),
			);
		});

		it("should throw a 404 AppError if the user is not found", async () => {
			vi.mocked(cache.getOrSet).mockResolvedValue(null);

			await expect(getProfile("usr_not_found")).rejects.toThrowError(
				new AppError("User not found", httpStatusCodes.NOT_FOUND),
			);
		});
	});

	describe("updateProfile", () => {
		it("should throw a 400 AppError if payload is empty", async () => {
			await expect(updateProfile("usr_1", {})).rejects.toThrowError(
				new AppError("No data provided to update", httpStatusCodes.BAD_REQUEST),
			);
		});

		it("should map avatarUrl to image, update database, and invalidate cache", async () => {
			const updatedUser = {
				id: "usr_1",
				name: "Alice Smith",
				image: "https://example.com/new-avatar.jpg",
			};

			const updateMock = {
				set: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				returning: vi.fn().mockResolvedValue([updatedUser]),
			};
			vi.mocked(db.update).mockReturnValue(
				updateMock as unknown as ReturnType<typeof db.update>,
			);

			const result = await updateProfile("usr_1", {
				name: "Alice Smith",
				avatarUrl: "https://example.com/new-avatar.jpg",
			});

			expect(result).toEqual(updatedUser);
			expect(updateMock.set).toHaveBeenCalledWith({
				name: "Alice Smith",
				image: "https://example.com/new-avatar.jpg",
			});
			// Verifies cache invalidation occurred!
			expect(cache.del).toHaveBeenCalledWith("users:usr_1:profile");
		});
	});

	describe("deleteAccount", () => {
		it("should delete user and invalidate cache", async () => {
			const deletedUser = { id: "usr_1", name: "Alice" };

			const deleteMock = {
				where: vi.fn().mockReturnThis(),
				returning: vi.fn().mockResolvedValue([deletedUser]),
			};
			vi.mocked(db.delete).mockReturnValue(
				deleteMock as unknown as ReturnType<typeof db.delete>,
			);

			const result = await deleteAccount("usr_1");
			expect(result).toEqual(deletedUser);
			expect(cache.del).toHaveBeenCalledWith("users:usr_1:profile");
		});

		it("should throw a 404 AppError if delete returns empty", async () => {
			const deleteMock = {
				where: vi.fn().mockReturnThis(),
				returning: vi.fn().mockResolvedValue([]),
			};
			vi.mocked(db.delete).mockReturnValue(
				deleteMock as unknown as ReturnType<typeof db.delete>,
			);

			await expect(deleteAccount("usr_missing")).rejects.toThrowError(
				new AppError("User not found", httpStatusCodes.NOT_FOUND),
			);
		});
	});
});
