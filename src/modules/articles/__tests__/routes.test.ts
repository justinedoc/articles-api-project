import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/core/auth";
import { createMockSession, createTestApp } from "@/core/test-utils";
import { articlesRouter } from "../index";
import type { ArticleResponse } from "../schema";
import * as articleService from "../service";

describe("Articles Routes Integration Tests", () => {
	const app = createTestApp("/articles", articlesRouter);

	const mockArticle: ArticleResponse = {
		id: "art_123",
		authorId: "usr_123",
		title: "Test Title",
		slug: "test-title",
		excerpt: "Test excerpt",
		body: "Test body content",
		status: "published" as const,
		publishedAt: new Date(),
		createdAt: new Date(),
		updatedAt: new Date(),
		tags: ["test"],
		likeCount: 0,
		commentCount: 0,
		author: {
			id: "usr_123",
			username: "testuser",
			displayName: "Test User",
			avatarUrl: null,
		},
		isLiked: false,
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return 401 Unauthorized when POST /articles without auth", async () => {
		vi.spyOn(auth.api, "getSession").mockResolvedValue(null);

		const res = await app.request("/api/articles", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Draft", body: "Draft content" }),
		});

		expect(res.status).toBe(401);
		const json = await res.json();
		expect(json.success).toBe(false);
	});

	it("should return 422 Unprocessable Entity when POST /articles with invalid body", async () => {
		const session = createMockSession({ id: "usr_123" });
		vi.spyOn(auth.api, "getSession").mockResolvedValue(session);

		const res = await app.request("/api/articles", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "" }),
		});

		expect(res.status).toBe(422);
		const json = await res.json();
		expect(json.success).toBe(false);
	});

	it("should return 201 Created when authenticated user creates an article", async () => {
		const session = createMockSession({ id: "usr_123" });
		vi.spyOn(auth.api, "getSession").mockResolvedValue(session);
		vi.spyOn(articleService, "createArticle").mockResolvedValue(mockArticle);

		const res = await app.request("/api/articles", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "Test Title",
				body: "Test body content",
			}),
		});

		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data.id).toBe("art_123");
	});

	it("should return 200 OK with paginated articles on GET /articles", async () => {
		vi.spyOn(articleService, "listPublicArticles").mockResolvedValue({
			data: [mockArticle],
			nextCursor: null,
		});

		const res = await app.request("/api/articles");
		expect(res.status).toBe(200);

		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data.data).toHaveLength(1);
		expect(json.data.nextCursor).toBeNull();
	});

	it("should return 200 OK on GET /articles/:id for published article", async () => {
		vi.spyOn(articleService, "getPublicArticle").mockResolvedValue(mockArticle);

		const res = await app.request("/api/articles/art_123");
		expect(res.status).toBe(200);

		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data.id).toBe("art_123");
	});

	it("should return 200 OK on PATCH /articles/:id for article owner", async () => {
		const session = createMockSession({ id: "usr_123" });
		vi.spyOn(auth.api, "getSession").mockResolvedValue(session);
		vi.spyOn(articleService, "updateArticle").mockResolvedValue({
			...mockArticle,
			title: "Updated Title",
		});

		const res = await app.request("/api/articles/art_123", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Updated Title" }),
		});

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data.title).toBe("Updated Title");
	});

	it("should return 200 OK on DELETE /articles/:id for article owner", async () => {
		const session = createMockSession({ id: "usr_123" });
		vi.spyOn(auth.api, "getSession").mockResolvedValue(session);
		vi.spyOn(articleService, "deleteArticle").mockResolvedValue(undefined);

		const res = await app.request("/api/articles/art_123", {
			method: "DELETE",
		});

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.message).toBe("Article deleted successfully");
	});

	it("should return 200 OK on POST /articles/:id/like", async () => {
		const session = createMockSession({ id: "usr_123" });
		vi.spyOn(auth.api, "getSession").mockResolvedValue(session);
		vi.spyOn(articleService, "likeArticle").mockResolvedValue({
			count: 1,
			liked: true,
		});

		const res = await app.request("/api/articles/art_123/like", {
			method: "POST",
		});

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data).toEqual({ count: 1, liked: true });
	});

	it("should return 200 OK on DELETE /articles/:id/like", async () => {
		const session = createMockSession({ id: "usr_123" });
		vi.spyOn(auth.api, "getSession").mockResolvedValue(session);
		vi.spyOn(articleService, "unlikeArticle").mockResolvedValue({
			count: 0,
			liked: false,
		});

		const res = await app.request("/api/articles/art_123/like", {
			method: "DELETE",
		});

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data).toEqual({ count: 0, liked: false });
	});

	it("should return 200 OK and Cache-Control header on GET /articles/trending", async () => {
		vi.spyOn(auth.api, "getSession").mockResolvedValue(null);
		vi.spyOn(articleService, "getTrendingArticles").mockResolvedValue([
			{
				...mockArticle,
				engagementScore: 10,
				likeCount: 4,
				commentCount: 2,
			},
		]);

		const res = await app.request("/api/articles/trending");

		expect(res.status).toBe(200);
		expect(res.headers.get("Cache-Control")).toContain("public");
		expect(res.headers.get("Vary")).toContain("Authorization");
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data).toHaveLength(1);
		expect(json.data[0].engagementScore).toBe(10);
	});

	it("should return 401 Unauthorized on GET /articles/mine without auth", async () => {
		vi.spyOn(auth.api, "getSession").mockResolvedValue(null);

		const res = await app.request("/api/articles/mine");

		expect(res.status).toBe(401);
		const json = await res.json();
		expect(json.success).toBe(false);
	});

	it("should return 200 OK on GET /articles/mine for authenticated user", async () => {
		const session = createMockSession({ id: "usr_123" });
		vi.spyOn(auth.api, "getSession").mockResolvedValue(session);
		vi.spyOn(articleService, "listOwnedArticles").mockResolvedValue({
			data: [mockArticle],
			nextCursor: null,
		});

		const res = await app.request(
			"/api/articles/mine?status=published&limit=10",
		);

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data.data).toHaveLength(1);
		expect(articleService.listOwnedArticles).toHaveBeenCalledWith(
			"usr_123",
			undefined,
			10,
			"published",
			undefined,
			undefined,
		);
	});
});
