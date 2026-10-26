import * as httpStatusCodes from "stoker/http-status-codes";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cache } from "@/core/cache";
import { db } from "@/core/db";
import { AppError } from "@/core/errors";
import { createArticle, transitionArticle, updateArticle } from "../service";

vi.mock("@/core/cache", () => ({
	cache: { getOrSet: vi.fn(), del: vi.fn() },
}));

vi.mock("@/core/db", () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
}));

const draft = {
	id: "article-1",
	authorId: "user-1",
	title: "Draft",
	slug: "draft-article",
	excerpt: null,
	body: "Body",
	status: "draft" as const,
	publishedAt: null,
	createdAt: new Date(),
	updatedAt: new Date(),
};

describe("Article Service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates drafts with an immutable id-based slug", async () => {
		const created = { ...draft, slug: "my-title-article" };
		vi.mocked(db.insert).mockReturnValue({
			values: vi.fn().mockReturnThis(),
			returning: vi.fn().mockResolvedValue([created]),
		} as never);

		const result = await createArticle("user-1", {
			title: "My title",
			body: "Body",
		});

		expect(result).toEqual(created);
		expect(db.insert).toHaveBeenCalled();
	});

	it("rejects updates from users who do not own the article", async () => {
		vi.mocked(db.select).mockReturnValue({
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockResolvedValue([{ ...draft, authorId: "other-user" }]),
		} as never);

		await expect(
			updateArticle("article-1", "user-1", { title: "Changed" }),
		).rejects.toThrow(
			new AppError("You do not own this article", httpStatusCodes.FORBIDDEN),
		);
	});

	it("publishes drafts and rejects publishing an already published article", async () => {
		vi.mocked(db.select).mockReturnValue({
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockResolvedValue([draft]),
		} as never);
		const published = { ...draft, status: "published" as const };
		vi.mocked(db.update).mockReturnValue({
			set: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			returning: vi.fn().mockResolvedValue([published]),
		} as never);

		await expect(
			transitionArticle("article-1", "user-1", "published"),
		).resolves.toEqual(published);
		expect(cache.del).toHaveBeenCalledWith("articles:id:article-1");

		vi.mocked(db.select).mockReturnValue({
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockResolvedValue([published]),
		} as never);
		await expect(
			transitionArticle("article-1", "user-1", "published"),
		).rejects.toThrow(/Cannot transition article/);
	});
});
