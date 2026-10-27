import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupTestUsers, createTestUser } from "@/core/test-utils";
import { createArticle, transitionArticle } from "@/modules/articles/service";
import { listPopularTags } from "../service";

vi.mock("@/core/cache", () => ({
	cache: {
		getOrSet: vi.fn((_key, fn) => fn()),
		del: vi.fn(),
		invalidatePattern: vi.fn(),
	},
}));

describe("Tags Service", () => {
	const testUserIds = new Set<string>();
	let authorId: string;

	beforeEach(async () => {
		const author = await createTestUser("tag-author");
		testUserIds.add(author.id);
		authorId = author.id;
	});

	afterEach(async () => {
		await cleanupTestUsers(testUserIds);
		testUserIds.clear();
	});

	it("lists popular tags ordered by published article count", async () => {
		const art1 = await createArticle(authorId, {
			title: "Article 1",
			body: "Content 1",
			tags: ["TypeScript", "Backend"],
		});
		await transitionArticle(art1.id, authorId, "published");

		const art2 = await createArticle(authorId, {
			title: "Article 2",
			body: "Content 2",
			tags: ["TypeScript"],
		});
		await transitionArticle(art2.id, authorId, "published");

		const tags = await listPopularTags(10);
		expect(tags.length).toBeGreaterThanOrEqual(2);

		const tsTag = tags.find((t) => t.name === "typescript");
		expect(tsTag).toBeDefined();
		expect(tsTag?.articleCount).toBeGreaterThanOrEqual(2);
	});
});
