import { eq } from "drizzle-orm";
import * as httpStatusCodes from "stoker/http-status-codes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cache } from "@/core/cache";
import { db } from "@/core/db";
import { article, articleLike, comment, profile, user } from "@/core/db/schema";
import { AppError } from "@/core/errors";
import { cleanupTestUsers, createTestUser } from "@/core/test-utils";
import {
	createArticle,
	likeArticle,
	transitionArticle,
} from "@/modules/articles/service";
import { createComment } from "@/modules/comments/service";
import { deleteAccount, getAccount, getAccountCacheKey } from "../service";

vi.mock("@/core/cache", () => ({
	cache: {
		getOrSet: vi.fn(async (_key, fetchFn) => fetchFn()),
		del: vi.fn().mockResolvedValue(undefined),
	},
}));

describe("Account Service", () => {
	const userIds = new Set<string>();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(async () => {
		await cleanupTestUsers(userIds);
		userIds.clear();
	});

	describe("getAccount", () => {
		it("should return the user account from db and cache", async () => {
			const created = await createTestUser("get-account");
			userIds.add(created.id);

			const result = await getAccount(created.id);
			expect(result.id).toBe(created.id);
			expect(result.email).toBe(created.email);
			expect(cache.getOrSet).toHaveBeenCalledWith(
				getAccountCacheKey(created.id),
				expect.any(Function),
				expect.objectContaining({ ttlSeconds: 600 }),
			);
		});

		it("should throw a 404 AppError if the account is not found", async () => {
			await expect(getAccount("usr_not_found")).rejects.toThrow(
				new AppError("Account not found", httpStatusCodes.NOT_FOUND),
			);
		});
	});

	describe("deleteAccount", () => {
		it("should delete user and invalidate account and profile caches", async () => {
			const created = await createTestUser("delete-account");
			userIds.add(created.id);

			// Seed associated profile
			await db.insert(profile).values({
				id: `prof-${crypto.randomUUID()}`,
				userId: created.id,
				username: `user_${created.id.slice(-6)}`,
			});

			const result = await deleteAccount(created.id);
			expect(result.id).toBe(created.id);

			// Verify user is gone from DB
			const remaining = await db
				.select()
				.from(user)
				.where(eq(user.id, created.id));
			expect(remaining).toEqual([]);

			// Verify cache invalidations
			expect(cache.del).toHaveBeenCalledWith(getAccountCacheKey(created.id));
			expect(cache.del).toHaveBeenCalledWith(`profiles:user:${created.id}`);
			expect(cache.del).toHaveBeenCalledWith(
				`profiles:username:user_${created.id.slice(-6)}`,
			);
		});

		it("should throw a 404 AppError if user to delete is not found", async () => {
			await expect(deleteAccount("usr_missing")).rejects.toThrow(
				new AppError("Account not found", httpStatusCodes.NOT_FOUND),
			);
		});

		it("cascades articles, comments, and likes when an account is deleted", async () => {
			const owner = await createTestUser("owner");
			const commenter = await createTestUser("commenter");
			userIds.add(owner.id);
			userIds.add(commenter.id);

			const createdArticle = await createArticle(owner.id, {
				title: "Account cleanup",
				body: "Body",
				tags: ["cleanup"],
			});
			await transitionArticle(createdArticle.id, owner.id, "published");
			await createComment(createdArticle.id, commenter.id, {
				body: "Comment",
			});
			await likeArticle(createdArticle.id, commenter.id);

			await deleteAccount(owner.id);

			expect(await db.select().from(user).where(eq(user.id, owner.id))).toEqual(
				[],
			);
			expect(
				await db
					.select()
					.from(article)
					.where(eq(article.id, createdArticle.id)),
			).toEqual([]);
			expect(
				await db
					.select()
					.from(comment)
					.where(eq(comment.articleId, createdArticle.id)),
			).toEqual([]);
			expect(
				await db
					.select()
					.from(articleLike)
					.where(eq(articleLike.articleId, createdArticle.id)),
			).toEqual([]);
			expect(cache.del).toHaveBeenCalledWith(
				`articles:id:${createdArticle.id}`,
			);
		});
	});
});
