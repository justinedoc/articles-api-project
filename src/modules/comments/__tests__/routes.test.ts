import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/core/auth";
import { createMockSession, createTestApp } from "@/core/test-utils";
import { commentsRouter } from "../index";
import type { CommentItem } from "../schema";
import * as commentService from "../service";

describe("Comments Routes Integration Tests", () => {
	const app = createTestApp("/", commentsRouter);

	const mockComment: CommentItem = {
		id: "comment_123",
		articleId: "art_123",
		authorId: "usr_123",
		parentId: null,
		body: "A insightful comment",
		deletedAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		replyCount: 2,
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return 200 OK with list of root comments on GET /articles/:articleId/comments", async () => {
		vi.spyOn(commentService, "listComments").mockResolvedValue({
			data: [mockComment],
			nextCursor: null,
		});

		const res = await app.request("/api/articles/art_123/comments");
		expect(res.status).toBe(200);

		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data.data).toHaveLength(1);
		expect(json.data.data[0].id).toBe("comment_123");
		expect(json.data.data[0].replyCount).toBe(2);
	});

	it("should return 200 OK with list of replies on GET /comments/:commentId/replies", async () => {
		const mockReply: CommentItem = {
			...mockComment,
			id: "comment_reply_456",
			parentId: "comment_123",
			replyCount: 0,
		};

		vi.spyOn(commentService, "listCommentReplies").mockResolvedValue({
			data: [mockReply],
			nextCursor: null,
		});

		const res = await app.request("/api/comments/comment_123/replies");
		expect(res.status).toBe(200);

		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data.data).toHaveLength(1);
		expect(json.data.data[0].id).toBe("comment_reply_456");
		expect(json.data.data[0].parentId).toBe("comment_123");
	});

	it("should return 401 Unauthorized when POST /articles/:articleId/comments without auth", async () => {
		vi.spyOn(auth.api, "getSession").mockResolvedValue(null);

		const res = await app.request("/api/articles/art_123/comments", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ body: "New comment" }),
		});

		expect(res.status).toBe(401);
		const json = await res.json();
		expect(json.success).toBe(false);
	});

	it("should return 422 Unprocessable Entity when POST /articles/:articleId/comments with empty body", async () => {
		const session = createMockSession({ id: "usr_123" });
		vi.spyOn(auth.api, "getSession").mockResolvedValue(session);

		const res = await app.request("/api/articles/art_123/comments", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ body: "" }),
		});

		expect(res.status).toBe(422);
		const json = await res.json();
		expect(json.success).toBe(false);
	});

	it("should return 201 Created when authenticated user posts a comment", async () => {
		const session = createMockSession({ id: "usr_123" });
		vi.spyOn(auth.api, "getSession").mockResolvedValue(session);
		vi.spyOn(commentService, "createComment").mockResolvedValue(mockComment);

		const res = await app.request("/api/articles/art_123/comments", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ body: "A insightful comment" }),
		});

		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data.id).toBe("comment_123");
	});

	it("should return 200 OK when comment owner updates comment via PATCH /comments/:commentId", async () => {
		const session = createMockSession({ id: "usr_123" });
		vi.spyOn(auth.api, "getSession").mockResolvedValue(session);
		vi.spyOn(commentService, "updateComment").mockResolvedValue({
			...mockComment,
			body: "Updated comment text",
		});

		const res = await app.request("/api/comments/comment_123", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ body: "Updated comment text" }),
		});

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.success).toBe(true);
		expect(json.data.body).toBe("Updated comment text");
	});

	it("should return 200 OK when comment owner deletes comment via DELETE /comments/:commentId", async () => {
		const session = createMockSession({ id: "usr_123" });
		vi.spyOn(auth.api, "getSession").mockResolvedValue(session);
		vi.spyOn(commentService, "deleteComment").mockResolvedValue({
			...mockComment,
			deletedAt: new Date(),
			body: "Comment deleted",
		});

		const res = await app.request("/api/comments/comment_123", {
			method: "DELETE",
		});

		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data.deletedAt).toBeDefined();
	});
});
