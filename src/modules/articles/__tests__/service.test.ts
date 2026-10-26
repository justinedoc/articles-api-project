import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/core/db";
import {
	article,
	articleLike,
	articleTag,
	comment,
	tag,
} from "@/core/db/schema";
import { AppError } from "@/core/errors";
import { cleanupTestUsers, createTestUser } from "@/core/test-utils";
import {
	createArticle,
	deleteArticle,
	likeArticle,
	listPublicArticles,
	transitionArticle,
	unlikeArticle,
	updateArticle,
} from "../service";

vi.mock("@/core/cache", () => ({
	cache: { getOrSet: vi.fn(), del: vi.fn() },
}));

describe("Article Service (PostgreSQL integration)", () => {
	const testUserIds = new Set<string>();
	let userId: string;

	const createUser = async (label: string) => {
		const created = await createTestUser(label);
		testUserIds.add(created.id);
		return created;
	};

	beforeEach(async () => {
		userId = (await createUser("article-test-user")).id;
	});

	afterEach(async () => {
		await cleanupTestUsers(testUserIds);
		testUserIds.clear();
	});

	it("creates drafts and synchronizes normalized tags", async () => {
		const created = await createArticle(userId, {
			title: "TypeScript Patterns",
			body: "Useful TypeScript patterns",
			tags: [" TypeScript ", "typescript", "PostgreSQL"],
		});

		const links = await db
			.select({ name: tag.name })
			.from(articleTag)
			.innerJoin(tag, eq(tag.id, articleTag.tagId))
			.where(eq(articleTag.articleId, created.id));

		expect(created.status).toBe("draft");
		expect(links.map(({ name }) => name).sort()).toEqual([
			"postgresql",
			"typescript",
		]);
	});

	it("enforces ownership and lifecycle transitions", async () => {
		const otherUser = await createUser("other-user");
		const created = await createArticle(userId, {
			title: "Lifecycle",
			body: "Body",
		});

		await expect(
			updateArticle(created.id, otherUser.id, { title: "Nope" }),
		).rejects.toThrow(new AppError("You do not own this article", 403));

		const published = await transitionArticle(created.id, userId, "published");
		expect(published.status).toBe("published");
		await expect(
			transitionArticle(created.id, userId, "published"),
		).rejects.toThrow(/Cannot transition article/);
	});

	it("lists published articles with cursor, tag, and full-text filters", async () => {
		const matching = await createArticle(userId, {
			title: "Distributed Systems",
			body: "Reliable distributed systems with PostgreSQL",
			tags: ["Backend"],
		});
		await transitionArticle(matching.id, userId, "published");

		const draft = await createArticle(userId, {
			title: "Draft Systems",
			body: "This must not be public",
			tags: ["Backend"],
		});

		const filtered = await listPublicArticles(
			undefined,
			10,
			" backend ",
			"distributed systems",
		);
		expect(filtered.data.map(({ id }) => id)).toEqual([matching.id]);
		expect(filtered.nextCursor).toBeNull();
		expect(draft.status).toBe("draft");

		const page = await listPublicArticles(undefined, 1);
		expect(page.data).toHaveLength(1);
		expect(page.nextCursor).toBeNull();
	});

	it("supports idempotent likes and unlikes with accurate counts", async () => {
		const otherUser = await createUser("liker");
		const created = await createArticle(userId, {
			title: "Likeable",
			body: "Body",
		});
		await transitionArticle(created.id, userId, "published");

		await expect(likeArticle(created.id, otherUser.id)).resolves.toEqual({
			count: 1,
			liked: true,
		});
		await expect(likeArticle(created.id, otherUser.id)).resolves.toEqual({
			count: 1,
			liked: true,
		});
		await expect(unlikeArticle(created.id, otherUser.id)).resolves.toEqual({
			count: 0,
			liked: false,
		});
		await expect(unlikeArticle(created.id, otherUser.id)).resolves.toEqual({
			count: 0,
			liked: false,
		});
	});

	it("cascades article, comment, tag, and like cleanup on account deletion", async () => {
		const otherUser = await createUser("cleanup-liker");
		const created = await createArticle(userId, {
			title: "Cleanup",
			body: "Body",
			tags: ["Cleanup"],
		});
		await transitionArticle(created.id, userId, "published");
		await db.insert(comment).values({
			id: `comment-${crypto.randomUUID()}`,
			articleId: created.id,
			authorId: otherUser.id,
			body: "Comment",
		});
		await db.insert(articleLike).values({
			articleId: created.id,
			userId: otherUser.id,
		});

		await deleteArticle(created.id, userId);

		const remaining = await db
			.select({ id: article.id })
			.from(article)
			.where(eq(article.id, created.id));
		const remainingLinks = await db
			.select()
			.from(articleTag)
			.where(eq(articleTag.articleId, created.id));
		const remainingLikes = await db
			.select()
			.from(articleLike)
			.where(eq(articleLike.articleId, created.id));

		expect(remaining).toEqual([]);
		expect(remainingLinks).toEqual([]);
		expect(remainingLikes).toEqual([]);
	});
});
