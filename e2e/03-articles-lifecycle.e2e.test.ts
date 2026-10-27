import { afterAll, describe, expect, it } from "vitest";
import { apiClient } from "./helpers/client";
import { cleanupE2EUsers, createE2EUser } from "./helpers/test-user";

describe("E2E: Articles Lifecycle & Social Interactions", () => {
	const createdUserIds = new Set<string>();

	afterAll(async () => {
		await cleanupE2EUsers(createdUserIds);
	});

	it("should create a draft article with tags and protect draft visibility", async () => {
		const author = await createE2EUser("author_1");
		const reader = await createE2EUser("reader_1");
		createdUserIds.add(author.id);
		createdUserIds.add(reader.id);

		// 1. Author creates draft article
		const createRes = await author.client.post<{
			success: boolean;
			data: {
				id: string;
				title: string;
				status: string;
				slug: string;
				publishedAt: string | null;
			};
		}>("/api/v1/articles", {
			title: "Building Modern Web Services",
			excerpt: "A deep dive into architecture and testing",
			body: "Full article body content about modern development.",
			tags: ["typescript", "testing", "architecture"],
		});

		expect(createRes.status).toBe(201);
		expect(createRes.data.success).toBe(true);
		const articleId = createRes.data.data.id;
		expect(articleId).toBeDefined();
		expect(createRes.data.data.status).toBe("draft");
		expect(createRes.data.data.publishedAt).toBeNull();
		expect(createRes.data.data.slug).toContain("building-modern-web-services");

		// 2. Author can view their own draft via /articles/:id/mine
		const authorView = await author.client.get<{
			data: { id: string; status: string };
		}>(`/api/v1/articles/${articleId}/mine`);
		expect(authorView.status).toBe(200);
		expect(authorView.data.data.status).toBe("draft");

		// 3. Reader cannot view unpublished draft (returns 404)
		const readerView = await reader.client.get(`/api/v1/articles/${articleId}`);
		expect(readerView.status).toBe(404);

		// 4. Public unauthenticated request cannot view draft (returns 404)
		const publicView = await apiClient.get(`/api/v1/articles/${articleId}`);
		expect(publicView.status).toBe(404);
	});

	it("should enforce ownership on article updates and reject non-authors with 403", async () => {
		const author = await createE2EUser("author_2");
		const intruder = await createE2EUser("intruder_2");
		createdUserIds.add(author.id);
		createdUserIds.add(intruder.id);

		const createRes = await author.client.post<{ data: { id: string } }>(
			"/api/v1/articles",
			{
				title: "Original Title",
				body: "Original content",
			},
		);
		const articleId = createRes.data.data.id;

		// Intruder attempts to update
		const intruderUpdate = await intruder.client.patch(
			`/api/v1/articles/${articleId}`,
			{
				title: "Hacked Title",
			},
		);
		expect(intruderUpdate.status).toBe(403);
		expect(intruderUpdate.text).toContain("You do not own this article");

		// Author successfully updates
		const authorUpdate = await author.client.patch<{
			data: { title: string; body: string };
		}>(`/api/v1/articles/${articleId}`, {
			title: "Refined Title",
			tags: ["updated", "clean"],
		});
		expect(authorUpdate.status).toBe(200);
		expect(authorUpdate.data.data.title).toBe("Refined Title");
	});

	it("should manage status transitions and prevent invalid transitions with 409", async () => {
		const author = await createE2EUser("author_3");
		createdUserIds.add(author.id);

		const createRes = await author.client.post<{ data: { id: string } }>(
			"/api/v1/articles",
			{
				title: "Transition Testing",
				body: "Testing state machine transitions",
			},
		);
		const articleId = createRes.data.data.id;

		// Attempt invalid transition: draft -> archive (returns 409)
		const invalidArchive = await author.client.post(
			`/api/v1/articles/${articleId}/archive`,
		);
		expect(invalidArchive.status).toBe(409);
		expect(invalidArchive.text).toContain(
			"Cannot transition article from draft to archived",
		);

		// Valid transition: draft -> published
		const publishRes = await author.client.post<{
			data: { status: string; publishedAt: string };
		}>(`/api/v1/articles/${articleId}/publish`);
		expect(publishRes.status).toBe(200);
		expect(publishRes.data.data.status).toBe("published");
		expect(publishRes.data.data.publishedAt).toBeDefined();

		// Published article is now publicly accessible
		const publicGet = await apiClient.get<{ data: { id: string } }>(
			`/api/v1/articles/${articleId}`,
		);
		expect(publicGet.status).toBe(200);
		expect(publicGet.data.data.id).toBe(articleId);

		// Valid transition: published -> archived
		const archiveRes = await author.client.post<{ data: { status: string } }>(
			`/api/v1/articles/${articleId}/archive`,
		);
		expect(archiveRes.status).toBe(200);
		expect(archiveRes.data.data.status).toBe("archived");

		// Archived article is no longer public
		const archivedPublicGet = await apiClient.get(
			`/api/v1/articles/${articleId}`,
		);
		expect(archivedPublicGet.status).toBe(404);
	});

	it("should support public search, tag filtering, and cursor pagination", async () => {
		const author = await createE2EUser("author_search");
		createdUserIds.add(author.id);

		const uniqueTopic = `topic_${Date.now()}`;

		// Create and publish two articles with the unique topic
		const article1 = await author.client.post<{ data: { id: string } }>(
			"/api/v1/articles",
			{
				title: `Guide to Quantum Mechanics ${uniqueTopic}`,
				body: `Exploring physics and quantum computing for ${uniqueTopic}`,
				tags: [uniqueTopic, "physics"],
			},
		);
		await author.client.post(
			`/api/v1/articles/${article1.data.data.id}/publish`,
		);

		const article2 = await author.client.post<{ data: { id: string } }>(
			"/api/v1/articles",
			{
				title: `Relativity Basics ${uniqueTopic}`,
				body: `Special and general relativity notes ${uniqueTopic}`,
				tags: [uniqueTopic, "relativity"],
			},
		);
		await author.client.post(
			`/api/v1/articles/${article2.data.data.id}/publish`,
		);

		// Tag filtering
		const tagRes = await apiClient.get<{
			data: {
				data: Array<{ id: string; title: string }>;
				nextCursor: string | null;
			};
		}>(`/api/v1/articles?tag=${uniqueTopic}`);
		expect(tagRes.status).toBe(200);
		expect(tagRes.data.data.data.length).toBe(2);

		// Specific tag filter
		const physicsRes = await apiClient.get<{
			data: {
				data: Array<{ id: string }>;
			};
		}>(`/api/v1/articles?tag=physics`);
		expect(physicsRes.status).toBe(200);
		expect(
			physicsRes.data.data.data.some((a) => a.id === article1.data.data.id),
		).toBe(true);

		// Full-text search
		const searchRes = await apiClient.get<{
			data: {
				data: Array<{ id: string }>;
			};
		}>(`/api/v1/articles?search=quantum`);
		expect(searchRes.status).toBe(200);
		expect(
			searchRes.data.data.data.some((a) => a.id === article1.data.data.id),
		).toBe(true);

		// Cursor pagination: page size 1
		const page1 = await apiClient.get<{
			data: {
				data: Array<{ id: string }>;
				nextCursor: string | null;
			};
		}>(`/api/v1/articles?tag=${uniqueTopic}&limit=1`);
		expect(page1.status).toBe(200);
		expect(page1.data.data.data.length).toBe(1);
		expect(page1.data.data.nextCursor).toBeDefined();

		// Page 2 using nextCursor
		const page2 = await apiClient.get<{
			data: {
				data: Array<{ id: string }>;
				nextCursor: string | null;
			};
		}>(
			`/api/v1/articles?tag=${uniqueTopic}&limit=1&cursor=${page1.data.data.nextCursor}`,
		);
		expect(page2.status).toBe(200);
		expect(page2.data.data.data.length).toBe(1);
		expect(page2.data.data.data[0].id).not.toBe(page1.data.data.data[0].id);
	});

	it("should allow authenticated users to like and unlike published articles", async () => {
		const author = await createE2EUser("author_likes");
		const reader = await createE2EUser("reader_likes");
		createdUserIds.add(author.id);
		createdUserIds.add(reader.id);

		// Create & publish
		const articleRes = await author.client.post<{ data: { id: string } }>(
			"/api/v1/articles",
			{
				title: "Liking Feature Test",
				body: "Test content for likes",
			},
		);
		const articleId = articleRes.data.data.id;
		await author.client.post(`/api/v1/articles/${articleId}/publish`);

		// 1. Reader likes article
		const likeRes = await reader.client.post<{
			success: boolean;
			data: { count: number; liked: boolean };
		}>(`/api/v1/articles/${articleId}/like`);
		expect(likeRes.status).toBe(200);
		expect(likeRes.data.data.count).toBe(1);
		expect(likeRes.data.data.liked).toBe(true);

		// 2. Duplicate like is idempotent
		const duplicateLike = await reader.client.post<{
			data: { count: number; liked: boolean };
		}>(`/api/v1/articles/${articleId}/like`);
		expect(duplicateLike.status).toBe(200);
		expect(duplicateLike.data.data.count).toBe(1);
		expect(duplicateLike.data.data.liked).toBe(true);

		// 3. Reader unlikes article
		const unlikeRes = await reader.client.delete<{
			success: boolean;
			data: { count: number; liked: boolean };
		}>(`/api/v1/articles/${articleId}/like`);
		expect(unlikeRes.status).toBe(200);
		expect(unlikeRes.data.data.count).toBe(0);
		expect(unlikeRes.data.data.liked).toBe(false);
	});

	it("should allow authors to delete owned articles and clean up cache", async () => {
		const author = await createE2EUser("author_del");
		createdUserIds.add(author.id);

		const articleRes = await author.client.post<{ data: { id: string } }>(
			"/api/v1/articles",
			{
				title: "Article to delete",
				body: "Will be deleted",
			},
		);
		const articleId = articleRes.data.data.id;

		// Author deletes article
		const deleteRes = await author.client.delete(
			`/api/v1/articles/${articleId}`,
		);
		expect(deleteRes.status).toBe(200);

		// Verify article is gone
		const checkRes = await author.client.get(`/api/v1/articles/${articleId}`);
		expect(checkRes.status).toBe(404);
	});
});
