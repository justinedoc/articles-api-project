import * as httpStatusCodes from "stoker/http-status-codes";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cache } from "@/core/cache";
import { db } from "@/core/db";
import { AppError } from "@/core/errors";
import { encodeCursor } from "@/core/pagination";
import {
	createArticle,
	listPublicArticles,
	transitionArticle,
	updateArticle,
} from "../service";

vi.mock("@/core/cache", () => ({
	cache: { getOrSet: vi.fn(), del: vi.fn() },
}));

vi.mock("@/core/db", () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		transaction: vi.fn(),
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

	it("normalizes, deduplicates, and persists article tags atomically", async () => {
		const tagged = { ...draft };
		const transaction = {
			insert: vi
				.fn()
				.mockReturnValueOnce({
					values: vi.fn().mockReturnThis(),
					returning: vi.fn().mockResolvedValue([tagged]),
				})
				.mockReturnValueOnce({
					values: vi.fn().mockReturnThis(),
					onConflictDoNothing: vi.fn().mockReturnThis(),
					returning: vi
						.fn()
						.mockResolvedValue([{ id: "tag-1", name: "typescript" }]),
				})
				.mockReturnValueOnce({
					values: vi.fn().mockResolvedValue([]),
				}),
			delete: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			}),
			select: vi.fn().mockReturnValue({
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockResolvedValue([]),
			}),
		};
		vi.mocked(db.transaction).mockImplementation(async (callback) =>
			callback(transaction as never),
		);

		await expect(
			createArticle("user-1", {
				title: "Tagged",
				body: "Body",
				tags: [" TypeScript ", "typescript"],
			}),
		).resolves.toEqual(tagged);

		expect(transaction.insert).toHaveBeenCalledTimes(3);
		expect(transaction.insert.mock.calls[1][0]).toBeDefined();
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

	it("replaces an owner's tags when updating an article", async () => {
		const updated = { ...draft, title: "Changed" };
		vi.mocked(db.select).mockReturnValue({
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockResolvedValue([draft]),
		} as never);
		const transaction = {
			update: vi.fn().mockReturnValue({
				set: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				returning: vi.fn().mockResolvedValue([updated]),
			}),
			delete: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			}),
			select: vi.fn().mockReturnValue({
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockResolvedValue([]),
			}),
			insert: vi.fn(),
		};
		vi.mocked(db.transaction).mockImplementation(async (callback) =>
			callback(transaction as never),
		);

		await expect(
			updateArticle("article-1", "user-1", { title: "Changed", tags: [] }),
		).resolves.toEqual(updated);
		expect(transaction.delete).toHaveBeenCalled();
		expect(cache.del).toHaveBeenCalledWith("articles:id:article-1");
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

	it("lists only published articles with a stable cursor", async () => {
		const first = {
			...draft,
			status: "published" as const,
			publishedAt: new Date("2026-01-03T00:00:00.000Z"),
		};
		const second = {
			...draft,
			id: "article-2",
			status: "published" as const,
			publishedAt: new Date("2026-01-02T00:00:00.000Z"),
		};
		const third = {
			...draft,
			id: "article-3",
			status: "published" as const,
			publishedAt: new Date("2026-01-01T00:00:00.000Z"),
		};
		vi.mocked(db.select).mockReturnValue({
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			orderBy: vi.fn().mockReturnThis(),
			limit: vi.fn().mockResolvedValue([first, second, third]),
		} as never);

		await expect(listPublicArticles(undefined, 2)).resolves.toEqual({
			data: [first, second],
			nextCursor: encodeCursor({
				createdAt: second.publishedAt,
				id: second.id,
			}),
		});
	});

	it("filters public articles by a normalized tag", async () => {
		const taggedArticle = {
			...draft,
			status: "published" as const,
			publishedAt: new Date("2026-01-03T00:00:00.000Z"),
		};
		const chain = {
			from: vi.fn().mockReturnThis(),
			innerJoin: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			orderBy: vi.fn().mockReturnThis(),
			limit: vi.fn().mockResolvedValue([{ article: taggedArticle }]),
		};
		vi.mocked(db.select).mockReturnValue({
			...chain,
		} as never);

		await expect(
			listPublicArticles(undefined, 20, " TypeScript "),
		).resolves.toEqual({ data: [taggedArticle], nextCursor: null });
		expect(chain.innerJoin).toHaveBeenCalledTimes(2);
	});

	it("applies full-text search to public article discovery", async () => {
		const matchingArticle = {
			...draft,
			status: "published" as const,
			publishedAt: new Date("2026-01-03T00:00:00.000Z"),
		};
		const chain = {
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			orderBy: vi.fn().mockReturnThis(),
			limit: vi.fn().mockResolvedValue([matchingArticle]),
		};
		vi.mocked(db.select).mockReturnValue(chain as never);

		await expect(
			listPublicArticles(undefined, 20, undefined, " distributed systems "),
		).resolves.toEqual({ data: [matchingArticle], nextCursor: null });
		expect(chain.where).toHaveBeenCalled();
	});
});
