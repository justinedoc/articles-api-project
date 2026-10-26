import * as httpStatusCodes from "stoker/http-status-codes";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cache } from "@/core/cache";
import { db } from "@/core/db";
import { AppError } from "@/core/errors";
import { deleteAccount, getAccount } from "../service";

vi.mock("@/core/cache", () => ({
	cache: {
		getOrSet: vi.fn(),
		del: vi.fn(),
	},
}));

vi.mock("@/core/db", () => ({
	db: {
		select: vi.fn(),
		delete: vi.fn(),
		transaction: vi.fn(),
	},
}));

describe("Account Service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(db.transaction).mockImplementation(async (callback) =>
			callback({
				select: db.select,
				delete: db.delete,
			} as never),
		);
	});

	describe("getAccount", () => {
		it("should return the user account from cache or db", async () => {
			const mockAccount = {
				id: "usr_1",
				name: "Alice",
				email: "alice@example.com",
				emailVerified: true,
				image: "https://example.com/avatar.jpg",
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			vi.mocked(cache.getOrSet).mockImplementation(
				async (_key, fetchFn) => (await fetchFn()) ?? mockAccount,
			);

			const selectMock = {
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockResolvedValue([mockAccount]),
			};
			vi.mocked(db.select).mockReturnValue(
				selectMock as unknown as ReturnType<typeof db.select>,
			);

			const result = await getAccount("usr_1");
			expect(result).toEqual(mockAccount);
			expect(cache.getOrSet).toHaveBeenCalledWith(
				"account:user:usr_1",
				expect.any(Function),
				expect.objectContaining({ ttlSeconds: 600 }),
			);
		});

		it("should throw a 404 AppError if the account is not found", async () => {
			vi.mocked(cache.getOrSet).mockResolvedValue(null);

			await expect(getAccount("usr_not_found")).rejects.toThrow(
				new AppError("Account not found", httpStatusCodes.NOT_FOUND),
			);
		});
	});

	describe("deleteAccount", () => {
		it("should delete user and invalidate account and profile caches", async () => {
			const deletedUser = { id: "usr_1", email: "alice@example.com" };

			// Mock profile select to get username
			const selectMock = {
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockResolvedValue([{ username: "alice" }]),
			};
			vi.mocked(db.select).mockReturnValue(
				selectMock as unknown as ReturnType<typeof db.select>,
			);

			const deleteMock = {
				where: vi.fn().mockReturnThis(),
				returning: vi.fn().mockResolvedValue([deletedUser]),
			};
			vi.mocked(db.delete).mockReturnValue(
				deleteMock as unknown as ReturnType<typeof db.delete>,
			);

			const result = await deleteAccount("usr_1");
			expect(result).toEqual(deletedUser);
			expect(cache.del).toHaveBeenCalledWith("account:user:usr_1");
			expect(cache.del).toHaveBeenCalledWith("profiles:user:usr_1");
			expect(cache.del).toHaveBeenCalledWith("profiles:username:alice");
		});

		it("should throw a 404 AppError if delete returns empty", async () => {
			const selectMock = {
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockResolvedValue([]),
			};
			vi.mocked(db.select).mockReturnValue(
				selectMock as unknown as ReturnType<typeof db.select>,
			);

			const deleteMock = {
				where: vi.fn().mockReturnThis(),
				returning: vi.fn().mockResolvedValue([]),
			};
			vi.mocked(db.delete).mockReturnValue(
				deleteMock as unknown as ReturnType<typeof db.delete>,
			);

			await expect(deleteAccount("usr_missing")).rejects.toThrow(
				new AppError("Account not found", httpStatusCodes.NOT_FOUND),
			);
		});
	});
});
