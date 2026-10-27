import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/core/db";
import {
	article,
	articleLike,
	articleTag,
	comment,
	profile,
	tag,
} from "@/core/db/schema";
import { AppError } from "@/core/errors";
import { cleanupTestUsers, createTestUser } from "@/core/test-utils";
import {
	createArticle,
	deleteArticle,
	getArticleLikesCount,
	getPublicArticle,
	getTrendingArticles,
	likeArticle,
	listOwnedArticles,
	listPublicArticles,
	transitionArticle,
	unlikeArticle,
	updateArticle,
} from "../service";

vi.mock("@/core/cache", () => ({
	cache: {
		getOrSet: vi.fn((_key, fn) => fn()),
		getRaw: vi.fn().mockResolvedValue(null),
		set: vi.fn().mockResolvedValue(undefined),
		del: vi.fn().mockResolvedValue(undefined),
		incr: vi.fn().mockResolvedValue(1),
		decr: vi.fn().mockResolvedValue(0),
		invalidatePattern: vi.fn().mockResolvedValue(1),
	},
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

		const updatedWithOnlyTags = await updateArticle(created.id, userId, {
			tags: ["Database", "Architecture"],
		});
		expect(updatedWithOnlyTags.id).toBe(created.id);

		const updatedLinks = await db
			.select({ name: tag.name })
			.from(articleTag)
			.innerJoin(tag, eq(tag.id, articleTag.tagId))
			.where(eq(articleTag.articleId, created.id));
		expect(updatedLinks.map(({ name }) => name).sort()).toEqual([
			"architecture",
			"database",
		]);
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

		const page = await listPublicArticles(undefined, 1, "backend");
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

		const countFromDb = await getArticleLikesCount(created.id);
		expect(countFromDb).toBe(0);
	});

	it("retrieves curated trending articles sorted by engagement", async () => {
		const userA = await createUser("trending-a");
		const userB = await createUser("trending-b");

		const art1 = await createArticle(userId, {
			title: "Trending Article 1",
			body: "Content 1",
		});
		await transitionArticle(art1.id, userId, "published");

		const art2 = await createArticle(userId, {
			title: "Trending Article 2",
			body: "Content 2",
		});
		await transitionArticle(art2.id, userId, "published");

		// art2 gets 2 likes, art1 gets 1 like
		await likeArticle(art2.id, userA.id);
		await likeArticle(art2.id, userB.id);
		await likeArticle(art1.id, userA.id);

		const trending = await getTrendingArticles(10);
		expect(trending.length).toBeGreaterThanOrEqual(2);

		const top = trending.find((a) => a.id === art2.id);
		const second = trending.find((a) => a.id === art1.id);
		expect(top).toBeDefined();
		expect(second).toBeDefined();
		expect(top?.likeCount).toBe(2);
		expect(top?.engagementScore).toBe(4);
		expect(second?.likeCount).toBe(1);
		expect(second?.engagementScore).toBe(2);
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

	it("lists owned articles with status filtering and pagination", async () => {
		const otherUser = await createUser("other-author");

		// Create articles for primary author
		const draft1 = await createArticle(userId, {
			title: "Draft 1",
			body: "First draft",
			tags: ["typescript"],
		});
		const draft2 = await createArticle(userId, {
			title: "Draft 2",
			body: "Second draft",
			tags: ["testing"],
		});
		const pub = await createArticle(userId, {
			title: "Published Article",
			body: "Live content",
			tags: ["typescript"],
		});
		await transitionArticle(pub.id, userId, "published");

		// Create article for other author
		await createArticle(otherUser.id, {
			title: "Other Author Article",
			body: "Should not be listed",
		});

		// 1. List all owned articles (no status filter)
		const allOwned = await listOwnedArticles(userId, undefined, 10);
		expect(allOwned.data.length).toBe(3);
		expect(allOwned.data.map((a) => a.id).sort()).toEqual(
			[draft1.id, draft2.id, pub.id].sort(),
		);

		// 2. Filter by status = "draft"
		const draftsOnly = await listOwnedArticles(userId, undefined, 10, "draft");
		expect(draftsOnly.data.length).toBe(2);
		expect(draftsOnly.data.every((a) => a.status === "draft")).toBe(true);

		// 3. Filter by status = "published"
		const pubOnly = await listOwnedArticles(userId, undefined, 10, "published");
		expect(pubOnly.data.length).toBe(1);
		expect(pubOnly.data[0].id).toBe(pub.id);

		// 4. Cursor pagination on owned articles
		const page1 = await listOwnedArticles(userId, undefined, 1);
		expect(page1.data.length).toBe(1);
		expect(page1.nextCursor).toBeDefined();

		const page2 = await listOwnedArticles(
			userId,
			page1.nextCursor ?? undefined,
			1,
		);
		expect(page2.data.length).toBe(1);
		expect(page2.data[0].id).not.toBe(page1.data[0].id);
	});

	it("enriches articles with alphabetical tags, metrics, author profile, and viewer like state", async () => {
		const viewer = await createUser("viewer");
		await db.insert(profile).values({
			id: `profile-${crypto.randomUUID()}`,
			userId,
			username: "author_jane",
		});

		const created = await createArticle(userId, {
			title: "Enriched Article",
			body: "Full body content",
			tags: ["typescript", "backend", "architecture"],
		});

		// Tags should be sorted alphabetically
		expect(created.tags).toEqual(["architecture", "backend", "typescript"]);
		expect(created.likeCount).toBe(0);
		expect(created.commentCount).toBe(0);
		expect(created.author.username).toBe("author_jane");
		expect(created.isLiked).toBe(false);

		await transitionArticle(created.id, userId, "published");

		// Anonymous viewer
		const anonPublic = await getPublicArticle(created.id);
		expect(anonPublic.isLiked).toBe(false);
		expect(anonPublic.likeCount).toBe(0);
		expect(anonPublic.author.username).toBe("author_jane");

		// Viewer likes article
		await likeArticle(created.id, viewer.id);

		// Authenticated viewer sees isLiked: true
		const viewerPublic = await getPublicArticle(created.id, viewer.id);
		expect(viewerPublic.likeCount).toBe(1);
		expect(viewerPublic.isLiked).toBe(true);

		// Anonymous still sees isLiked: false but updated likeCount
		const anonAfterLike = await getPublicArticle(created.id);
		expect(anonAfterLike.likeCount).toBe(1);
		expect(anonAfterLike.isLiked).toBe(false);

		// Filter public articles by author username
		const byAuthor = await listPublicArticles(
			undefined,
			10,
			undefined,
			undefined,
			"author_jane",
			viewer.id,
		);
		expect(byAuthor.data.some((a) => a.id === created.id)).toBe(true);
		const found = byAuthor.data.find((a) => a.id === created.id);
		expect(found?.isLiked).toBe(true);

		// Filter by non-existent author
		const byUnknown = await listPublicArticles(
			undefined,
			10,
			undefined,
			undefined,
			"nonexistent_user",
		);
		expect(byUnknown.data.length).toBe(0);
	});
});
